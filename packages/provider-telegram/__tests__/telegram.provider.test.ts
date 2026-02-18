/* eslint-disable import/order */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'

// Mock path module
jest.mock('path', () => ({
    __esModule: true,
    default: {
        join: (...args: string[]) => args.join('/'),
    },
    join: (...args: string[]) => args.join('/'),
}))

// Mock fs module - use __esModule and default for ESM compatibility
jest.mock('fs', () => ({
    __esModule: true,
    default: {
        existsSync: jest.fn(() => true),
        mkdirSync: jest.fn(),
        readFileSync: jest.fn(() => 'saved-session'),
        writeFileSync: jest.fn(),
        unlinkSync: jest.fn(),
    },
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
    readFileSync: jest.fn(() => 'saved-session'),
    writeFileSync: jest.fn(),
    unlinkSync: jest.fn(),
}))

// Imports must come after jest.mock() to get mocked versions
import fs from 'fs'
import path from 'path'
/* eslint-enable import/order */

jest.mock('telegram', () => ({
    TelegramClient: jest.fn().mockImplementation(() => ({
        start: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        sendMessage: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        sendFile: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        getMe: jest.fn<() => Promise<{ id: string }>>().mockResolvedValue({ id: '12345' }),
        iterDialogs: jest.fn().mockReturnValue({
            [Symbol.asyncIterator]: () => ({
                next: jest.fn<() => Promise<{ done: boolean }>>().mockResolvedValue({ done: true }),
            }),
        }),
        markAsRead: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        downloadMedia: jest.fn<() => Promise<Buffer>>().mockResolvedValue(Buffer.from('media-data')),
        addEventHandler: jest.fn(),
        session: { save: jest.fn().mockReturnValue('session-string') },
    })),
    Api: {
        User: jest.fn(),
    },
}))

jest.mock('telegram/events/index.js', () => ({
    NewMessage: jest.fn().mockImplementation(() => ({})),
    NewMessageEvent: jest.fn(),
}))

jest.mock('telegram/sessions/index.js', () => ({
    StringSession: jest.fn().mockImplementation(() => ({})),
}))

jest.mock('@builderbot/bot', () => {
    const EventEmitter = require('events')
    class MockProviderClass {
        emit = jest.fn()
        on = jest.fn()
        server = null
        vendor = null
    }
    class MockEventEmitterClass extends EventEmitter {}
    return {
        ProviderClass: MockProviderClass,
        EventEmitterClass: MockEventEmitterClass,
        utils: {
            generateRefProvider: jest.fn().mockImplementation((prefix: string) => `${prefix}_mock-uuid`),
            delay: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        },
    }
})

import { TelegramProvider } from '../src/telegram.provider'

describe('#TelegramProvider', () => {
    let provider: TelegramProvider

    beforeEach(() => {
        jest.clearAllMocks()
        ;(fs.existsSync as jest.Mock).mockReturnValue(true)

        provider = new TelegramProvider({
            name: 'test-telegram',
            port: 3000,
            apiId: 12345,
            apiHash: 'test-hash',
            getCode: async () => '12345',
            apiNumber: '+1234567890',
        })
    })

    // ===== Constructor =====

    describe('#constructor', () => {
        test('should instantiate correctly with valid args', () => {
            expect(provider).toBeDefined()
            expect(provider.globalVendorArgs.apiId).toBe(12345)
            expect(provider.globalVendorArgs.apiHash).toBe('test-hash')
        })

        test('should throw if apiId is missing', () => {
            expect(() => {
                new TelegramProvider({
                    apiId: undefined as any,
                    apiHash: 'hash',
                    getCode: async () => '12345',
                })
            }).toThrow('Must provide Telegram API ID')
        })

        test('should throw if apiHash is missing', () => {
            expect(() => {
                new TelegramProvider({
                    apiId: 12345,
                    apiHash: undefined as any,
                    getCode: async () => '12345',
                })
            }).toThrow('Must provide Telegram API Hash')
        })

        test('should create session directory if it does not exist', () => {
            ;(fs.existsSync as jest.Mock).mockReturnValue(false)

            new TelegramProvider({
                apiId: 12345,
                apiHash: 'hash',
                getCode: async () => '12345',
            })

            expect(fs.mkdirSync).toHaveBeenCalled()
        })
    })

    // ===== sendMessage =====

    describe('#sendMessage', () => {
        test('should send a text message', async () => {
            await provider.sendMessage('user123', 'Hello')

            expect(provider.client.sendMessage).toHaveBeenCalledWith('user123', {
                message: 'Hello',
            })
        })

        test('should delegate to sendButtons when buttons are provided', async () => {
            const sendButtonsSpy = jest.spyOn(provider, 'sendButtons').mockResolvedValue(undefined)

            await provider.sendMessage('user123', 'Pick one', {
                buttons: [{ body: 'Option 1' }],
            } as any)

            expect(sendButtonsSpy).toHaveBeenCalledWith('user123', 'Pick one', [{ body: 'Option 1' }])
        })

        test('should delegate to sendMedia when mediaURL is provided', async () => {
            const sendMediaSpy = jest.spyOn(provider, 'sendMedia').mockResolvedValue(undefined)

            await provider.sendMessage('user123', 'caption', {
                mediaURL: 'https://example.com/image.jpg',
            } as any)

            expect(sendMediaSpy).toHaveBeenCalledWith('user123', 'https://example.com/image.jpg', 'caption')
        })
    })

    // ===== sendButtons =====

    describe('#sendButtons', () => {
        test('should return undefined (not implemented)', async () => {
            const result = await provider.sendButtons('user123', 'text', [])
            expect(result).toBeUndefined()
        })
    })

    // ===== sendMedia =====

    describe('#sendMedia', () => {
        test('should fetch media, write to disk, and send via client', async () => {
            const mockBuffer = new ArrayBuffer(8)
            global.fetch = jest.fn<() => Promise<Response>>().mockResolvedValue({
                arrayBuffer: () => Promise.resolve(mockBuffer),
                headers: { get: () => 'image/png' },
            } as unknown as Response)

            await provider.sendMedia('user123', 'https://example.com/img.png', 'caption')

            expect(fs.writeFileSync).toHaveBeenCalled()
            expect(provider.client.sendFile).toHaveBeenCalledWith(
                'user123',
                expect.objectContaining({
                    file: expect.any(String),
                    caption: 'caption',
                })
            )
        })

        test('should handle voice note extensions', async () => {
            global.fetch = jest.fn<() => Promise<Response>>().mockResolvedValue({
                arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
                headers: { get: () => 'audio/ogg' },
            } as unknown as Response)

            await provider.sendMedia('user123', 'https://example.com/voice.ogg', 'caption')

            expect(provider.client.sendFile).toHaveBeenCalledWith(
                'user123',
                expect.objectContaining({
                    voiceNote: true,
                })
            )
        })

        test('should handle video_note caption with mp4', async () => {
            global.fetch = jest.fn<() => Promise<Response>>().mockResolvedValue({
                arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
                headers: { get: () => 'video/mp4' },
            } as unknown as Response)

            await provider.sendMedia('user123', 'https://example.com/vid.mp4', 'video_note')

            expect(provider.client.sendFile).toHaveBeenCalledWith(
                'user123',
                expect.objectContaining({
                    videoNote: true,
                })
            )
        })
    })

    // ===== saveFile =====

    describe('#saveFile', () => {
        test('should download and save file returning path', async () => {
            const ctx = {
                message: {
                    file: { mimeType: 'image/jpeg' },
                },
                from: 'user123',
            }
            const options = { path: '/tmp/saved' }

            const result = await provider.saveFile(ctx as any, options)

            expect(provider.client.downloadMedia).toHaveBeenCalled()
            expect(fs.writeFileSync).toHaveBeenCalled()
            expect(result).toContain('/tmp/saved')
            expect(result).toContain('.jpeg')
        })

        test('should return empty string if message has no file', async () => {
            const ctx = {
                message: { file: null },
                from: 'user123',
            }

            const result = await provider.saveFile(ctx as any, { path: '/tmp' })

            expect(result).toBe('')
        })

        test('should handle errors gracefully', async () => {
            const ctx = {
                message: {
                    file: { mimeType: 'image/png' },
                },
                from: 'user123',
            }

            provider.client.downloadMedia = jest
                .fn<() => Promise<Buffer>>()
                .mockRejectedValue(new Error('Download failed'))

            const result = await provider.saveFile(ctx as any, { path: '/tmp' })

            expect(result).toBeUndefined()
        })
    })

    // ===== busEvents =====

    describe('#busEvents', () => {
        test('should return array with message event handler', () => {
            const events = provider['busEvents']()
            expect(events).toHaveLength(1)
            expect(events[0].event).toBe('message')
        })

        test('should detect voice messages and set body to voice_note event', () => {
            const events = provider['busEvents']()
            const handler = events[0].func

            const payload = {
                message: {
                    voice: true,
                    media: null,
                    message: 'test',
                },
                body: 'test',
            }

            handler(payload as any)

            expect(payload.body).toMatch(/_event_voice_note_/)
        })

        test('should detect media messages and set body to media event', () => {
            const events = provider['busEvents']()
            const handler = events[0].func

            const payload = {
                message: {
                    voice: false,
                    media: { someData: true },
                    message: 'media caption',
                },
                body: 'original',
                caption: undefined as string | undefined,
            }

            handler(payload as any)

            expect(payload.body).toMatch(/_event_media_/)
            expect(payload.caption).toBe('media caption')
        })

        test('should emit message event after processing', () => {
            const events = provider['busEvents']()
            const handler = events[0].func

            const payload = {
                message: { voice: false, media: null, message: 'hello' },
                body: 'hello',
            }

            handler(payload as any)

            expect(provider.emit).toHaveBeenCalledWith('message', payload)
        })
    })

    // ===== _getStringSession =====

    describe('#_getStringSession', () => {
        test('should use telegramJwt when available', () => {
            provider.globalVendorArgs.telegramJwt = 'jwt-token'
            ;(fs.existsSync as jest.Mock).mockReturnValue(false)

            const session = provider['_getStringSession']()
            expect(session).toBeDefined()
        })

        test('should read session from file if no jwt', () => {
            provider.globalVendorArgs.telegramJwt = undefined
            ;(fs.existsSync as jest.Mock).mockReturnValue(true)

            provider['_getStringSession']()

            expect(fs.readFileSync).toHaveBeenCalled()
        })
    })

    // ===== markAsRead =====

    describe('#markAsRead', () => {
        test('should delegate to client.markAsRead', async () => {
            await provider.markAsRead('user123')
            expect(provider.client.markAsRead).toHaveBeenCalledWith('user123')
        })
    })

    // ===== getUnreadMessages =====

    describe('#getUnreadMessages', () => {
        test('should return array of unread message lists', async () => {
            const result = await provider.getUnreadMessages()
            expect(Array.isArray(result)).toBe(true)
        })
    })

    // ===== getRespondedConversations =====

    describe('#getRespondedConversations', () => {
        test('should return array of responded conversation messages', async () => {
            const result = await provider.getRespondedConversations()
            expect(Array.isArray(result)).toBe(true)
        })
    })

    // ===== HTTP server hooks =====

    describe('#beforeHttpServerInit', () => {
        test('should be a no-op', () => {
            expect(() => provider['beforeHttpServerInit']()).not.toThrow()
        })
    })

    describe('#afterHttpServerInit', () => {
        test('should be a no-op', () => {
            expect(() => provider['afterHttpServerInit']()).not.toThrow()
        })
    })
})
