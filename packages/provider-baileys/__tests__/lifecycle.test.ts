/**
 * LAYER: Infrastructure
 * Contains: ProviderLifecycleTests
 * Rules: Mock WhatsApp sockets; use isolated temporary workspaces and a local HTTP server.
 * BigO: O(1) score:5
 * keywords: [ProviderLifecycleTests, Shutdown, Reconnect]
 * GOAL: Verify shutdown cannot restart sockets, lose pending flushes or leave HTTP responses unfinished.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { EventEmitter } from 'events'
import fs from 'fs'
import { get } from 'http'
import { basename } from 'path'

import { BaileysProvider } from '../src'
import * as wrapper from '../src/baileyWrapper'

jest.mock('../src/baileyWrapper', () => ({
    Browsers: { appropriate: () => ['Ubuntu', 'Chrome', '1'] },
    DisconnectReason: { connectionClosed: 428, loggedOut: 401 },
    useMultiFileAuthState: jest.fn(),
    fetchLatestWaWebVersion: jest.fn(),
    makeCacheableSignalKeyStore: (keys: unknown) => keys,
    makeWASocketOther: jest.fn(),
}))
jest.mock('../src/lidCache', () => ({
    createLidCache: () => ({ close: jest.fn(async () => {}) }),
}))
jest.mock('wa-sticker-formatter', () => ({ Sticker: jest.fn() }))

function deferred() {
    let resolve!: () => void
    const promise = new Promise<void>((done) => {
        resolve = done
    })
    return { promise, resolve }
}

describe('lifecycle review regressions', () => {
    let provider: BaileysProvider
    let socket: any

    beforeEach(() => {
        jest.clearAllMocks()
        socket = {
            ev: new EventEmitter(),
            end: jest.fn(async () => {
                socket.ev.emit('connection.update', {
                    connection: 'close',
                    lastDisconnect: { error: { output: { statusCode: 428 } } },
                })
            }),
            authState: { creds: { registered: true } },
        }
        jest.mocked(wrapper.useMultiFileAuthState).mockImplementation(
            async () =>
                ({
                    state: { creds: {}, keys: {} },
                    saveCreds: async () => {},
                }) as any
        )
        jest.mocked(wrapper.fetchLatestWaWebVersion).mockImplementation(async () => ({ version: [2, 3000, 1] }) as any)
        jest.mocked(wrapper.makeWASocketOther).mockReturnValue(socket)
        provider = new BaileysProvider({ name: 'lifecycle' })
    })

    afterEach(async () => {
        await provider.destroy()
        // A shutdown regression must fail the assertion, not hang Jest on the
        // test-owned HTTP listener.
        if (provider.server.server?.listening) {
            await new Promise<void>((resolve) => provider.server.server.close(() => resolve()))
        }
        jest.useRealTimers()
        jest.restoreAllMocks()
    })

    test('tests run outside application directories in their own temporary workspace', () => {
        expect(basename(process.cwd())).toMatch(/^builderbot-baileys-test-/)
    })

    test('destroy cancels pending reconnects and rejects future initialization', async () => {
        jest.useFakeTimers()
        await provider['initVendor']()
        await provider['delayedReconnect']()
        await provider.destroy()
        await jest.advanceTimersByTimeAsync(60_000)
        await provider['initVendor']()
        expect(wrapper.makeWASocketOther).toHaveBeenCalledTimes(1)
        expect(wrapper.useMultiFileAuthState).toHaveBeenCalledTimes(1)
    })

    test('late base-provider callbacks cannot reopen HTTP or attach listeners after destroy', async () => {
        await provider.destroy()
        const listenSpy = jest.spyOn(provider.server, 'listen')
        provider.start({} as any)
        expect(listenSpy).not.toHaveBeenCalled()
        expect(() => provider['listenOnEvents'](undefined)).not.toThrow()
    })

    test('socket end close event cannot schedule a reconnect during destroy', async () => {
        jest.useFakeTimers()
        await provider['initVendor']()
        await provider.destroy()
        await jest.advanceTimersByTimeAsync(60_000)
        expect(socket.end).toHaveBeenCalledTimes(1)
        expect(wrapper.makeWASocketOther).toHaveBeenCalledTimes(1)
        expect(provider['reconnectAttempts']).toBe(0)
    })

    test('concurrent destroy calls both await the final LID cache flush', async () => {
        const flush = deferred()
        jest.mocked(provider['lidCache'].close!).mockImplementation(() => flush.promise)
        let firstDone = false
        let secondDone = false
        const first = provider.destroy().then(() => {
            firstDone = true
        })
        const second = provider.destroy().then(() => {
            secondDone = true
        })
        try {
            await Promise.resolve()
            await Promise.resolve()
            expect(firstDone).toBe(false)
            expect(secondDone).toBe(false)
        } finally {
            flush.resolve()
            await Promise.all([first, second])
        }
        expect(provider['lidCache'].close).toHaveBeenCalledTimes(1)
    })

    test('destroy awaits asynchronous socket end', async () => {
        const end = deferred()
        socket.end.mockImplementation(() => end.promise)
        await provider['initVendor']()
        let done = false
        const closing = provider.destroy().then(() => {
            done = true
        })
        try {
            await Promise.resolve()
            await Promise.resolve()
            expect(done).toBe(false)
        } finally {
            end.resolve()
            await closing
        }
        expect(done).toBe(true)
    })

    test('destroy awaits a reconnect already closing the old socket', async () => {
        jest.useFakeTimers()
        const end = deferred()
        socket.end.mockImplementationOnce(() => end.promise)
        await provider['initVendor']()
        await provider['delayedReconnect']()
        jest.advanceTimersByTime(1000)
        let done = false
        const closing = provider.destroy().then(() => {
            done = true
        })
        try {
            await Promise.resolve()
            await Promise.resolve()
            await Promise.resolve()
            await Promise.resolve()
            expect(done).toBe(false)
            expect(socket.end).toHaveBeenCalledTimes(1)
        } finally {
            end.resolve()
            await closing
        }
        expect(wrapper.makeWASocketOther).toHaveBeenCalledTimes(1)
    })

    test('destroy during version resolution prevents a late socket from starting', async () => {
        const version = deferred()
        jest.mocked(wrapper.fetchLatestWaWebVersion).mockImplementation(async () => {
            await version.promise
            return { version: [2, 3000, 1] } as any
        })
        const init = provider['initVendor']()
        await Promise.resolve()
        await Promise.resolve()
        const closing = provider.destroy()
        version.resolve()
        await Promise.all([init, closing])
        expect(wrapper.makeWASocketOther).not.toHaveBeenCalled()
    })

    test('destroy cancels the periodic session cleanup timer', async () => {
        jest.useFakeTimers()
        fs.mkdirSync('lifecycle_sessions')
        provider.globalVendorArgs.timeRelease = 60_000
        await provider['initVendor']()
        const timer = provider['sessionCleanupTimer']
        expect(timer).toBeDefined()
        const clearSpy = jest.spyOn(global, 'clearInterval')
        await provider.destroy()
        expect(provider['sessionCleanupTimer']).toBeUndefined()
        expect(clearSpy).toHaveBeenCalledWith(timer)
    })

    test('missing QR returns 404 and destroy closes a real HTTP listener and the log stream', async () => {
        provider['beforeHttpServerInit']()
        await new Promise<void>((resolve) => provider.server.listen(0, resolve))
        const server = provider.server.server
        const address = server.address() as { port: number }
        const status = await new Promise<number>((resolve, reject) => {
            get(`http://127.0.0.1:${address.port}/`, (response) => {
                response.resume()
                response.on('end', () => resolve(response.statusCode!))
            }).on('error', reject)
        })
        expect(status).toBe(404)
        await provider.destroy()
        expect(server.listening).toBe(false)
        expect((provider['logStream'] as fs.WriteStream).writableFinished).toBe(true)
    })

    test('QR async open failure sends 404; failure after headers destroys the response', () => {
        const stream = Object.assign(new EventEmitter(), { pipe: jest.fn(), destroy: jest.fn() })
        jest.spyOn(fs, 'createReadStream').mockReturnValue(stream as any)
        const response = {
            headersSent: false,
            writeHead: jest.fn((_status: number, _headers: Record<string, string>) => {
                response.headersSent = true
            }),
            end: jest.fn(),
            destroy: jest.fn(),
            once: jest.fn(),
        }
        provider.indexHome({ bot: 'lifecycle' } as any, response as any, () => {})
        stream.emit('error', new Error('open failed'))
        expect(response.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'text/html' })
        expect(response.end).toHaveBeenCalledTimes(1)

        response.headersSent = false
        jest.clearAllMocks()
        provider.indexHome({ bot: 'lifecycle' } as any, response as any, () => {})
        stream.emit('open', 1)
        stream.emit('error', new Error('read failed'))
        expect(response.destroy).toHaveBeenCalledTimes(1)
    })
})
