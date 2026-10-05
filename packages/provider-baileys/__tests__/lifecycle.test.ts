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
    DisconnectReason: { connectionClosed: 428, loggedOut: 401, connectionReplaced: 440 },
    useMultiFileAuthState: jest.fn(),
    fetchLatestWaWebVersion: jest.fn(),
    makeCacheableSignalKeyStore: (keys: unknown) => keys,
    makeWASocketOther: jest.fn(),
}))
jest.mock('../src/lidCache', () => ({
    createLidCache: () => ({ close: jest.fn(async () => {}) }),
}))
jest.mock('wa-sticker-formatter', () => ({ Sticker: jest.fn() }))

// Keep pairing tests fast: the real utils.delay waits 2s after the code.
jest.mock('@builderbot/bot', () => {
    const actual = jest.requireActual<typeof import('@builderbot/bot')>('@builderbot/bot')
    return { ...actual, utils: { ...actual.utils, delay: async () => {} } }
})

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
            requestPairingCode: jest.fn(async () => 'PAIR1234'),
            user: { id: '15550000000:1@s.whatsapp.net' },
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

    test('loggedOut preserves auth files and emits auth_failure instead of wiping (T7)', async () => {
        const utilsModule = require('../src/utils')
        const emptySpy = jest.spyOn(utilsModule, 'emptyDirSessions')
        const emitSpy = jest.spyOn(provider, 'emit')
        await provider['initVendor']()

        socket.ev.emit('connection.update', {
            connection: 'close',
            lastDisconnect: { error: { output: { statusCode: 401 } } },
        })
        await Promise.resolve()

        expect(emptySpy).not.toHaveBeenCalled()
        expect(emitSpy).toHaveBeenCalledWith(
            'auth_failure',
            expect.arrayContaining([expect.stringContaining('preserved')])
        )
        expect(provider['reconnectTimer']).toBeUndefined()
        emptySpy.mockRestore()
    })

    test('connectionReplaced (440) emits auth_failure and never schedules a reconnect (T8)', async () => {
        jest.useFakeTimers()
        const emitSpy = jest.spyOn(provider, 'emit')
        await provider['initVendor']()

        socket.ev.emit('connection.update', {
            connection: 'close',
            lastDisconnect: { error: { output: { statusCode: 440 } } },
        })
        await Promise.resolve()

        expect(emitSpy).toHaveBeenCalledWith(
            'auth_failure',
            expect.arrayContaining([expect.stringContaining('replaced')])
        )
        expect(provider['reconnectTimer']).toBeUndefined()
        await jest.advanceTimersByTimeAsync(120_000)
        expect(wrapper.makeWASocketOther).toHaveBeenCalledTimes(1)
    })

    test('reconnect backoff applies jitter within ±20% of the base delay (T8)', async () => {
        jest.useFakeTimers()
        const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0)
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
        await provider['initVendor']()
        provider['reconnectAttempts'] = 2 // next attempt: base = 1000 * 2^2 = 4000

        await provider['delayedReconnect']()

        // random=0 → factor 0.8 → 3200, not the raw 4000 base
        expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 3200)
        jest.advanceTimersByTime(3199)
        expect(wrapper.makeWASocketOther).toHaveBeenCalledTimes(1)
        randomSpy.mockRestore()
    })

    test('pairing code is requested with the cleaned phone number (T6)', async () => {
        socket.authState.creds.registered = false
        provider.globalVendorArgs.usePairingCode = true
        provider.globalVendorArgs.phoneNumber = '+1 (555) 000-0001'

        await provider['initVendor']()

        expect(socket.requestPairingCode).toHaveBeenCalledWith('15550000001')
    })

    test('connection.update listeners are attached before pairing resolves (T6)', async () => {
        socket.authState.creds.registered = false
        provider.globalVendorArgs.usePairingCode = true
        provider.globalVendorArgs.phoneNumber = '15550000001'
        const pairing = deferred()
        socket.requestPairingCode.mockImplementationOnce(async () => {
            await pairing.promise
            return 'PAIR1234'
        })
        const emitSpy = jest.spyOn(provider, 'emit')

        const init = provider['initVendor']()
        await Promise.resolve()
        await Promise.resolve()
        // Socket still awaiting pairing, but a live connection event is handled
        socket.ev.emit('connection.update', { connection: 'open' })
        await Promise.resolve()
        expect(emitSpy).toHaveBeenCalledWith('ready', true)

        pairing.resolve()
        await init
    })

    test('connection open emits ready and host with parsed phone (T14)', async () => {
        const emitSpy = jest.spyOn(provider, 'emit')
        await provider['initVendor']()

        socket.ev.emit('connection.update', { connection: 'open' })
        await Promise.resolve()

        expect(emitSpy).toHaveBeenCalledWith('ready', true)
        expect(emitSpy).toHaveBeenCalledWith('host', expect.objectContaining({ phone: '15550000000' }))
        expect(provider['reconnectAttempts']).toBe(0)
    })

    test('qr event emits require_action and generates the QR image (T14)', async () => {
        const utilsModule = require('../src/utils')
        const qrSpy = jest.spyOn(utilsModule, 'baileyGenerateImage').mockResolvedValue(undefined)
        const emitSpy = jest.spyOn(provider, 'emit')
        await provider['initVendor']()

        socket.ev.emit('connection.update', { qr: '2@fake-qr-data' })
        await Promise.resolve()
        await Promise.resolve()

        expect(emitSpy).toHaveBeenCalledWith(
            'require_action',
            expect.objectContaining({ payload: { qr: '2@fake-qr-data' } })
        )
        expect(qrSpy).toHaveBeenCalledWith('2@fake-qr-data', 'lifecycle.qr.png')
        qrSpy.mockRestore()
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
