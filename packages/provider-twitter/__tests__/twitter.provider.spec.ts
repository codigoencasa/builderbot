import { beforeEach, describe, expect, jest, it } from '@jest/globals'

import { TwitterProvider } from '../src/twitter.provider'

jest.mock('@builderbot/bot', () => ({
    ProviderClass: class {
        server = {
            post: jest.fn().mockReturnThis(),
            get: jest.fn().mockReturnThis(),
        }
        emit = jest.fn()
        vendor: any
        constructor() {}
    },
}))

jest.mock('../src/twitter.events', () => ({
    TwitterEvents: jest.fn().mockImplementation(() => ({
        eventInMsg: jest.fn(),
        emitter: {},
        emit: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
    })),
}))

jest.mock('twitter-api-v2', () => ({
    TwitterApi: jest.fn().mockImplementation(() => ({
        v2: {
            me: jest.fn().mockResolvedValue({ data: { id: 'bot_123', username: 'bothandle' } } as never),
            sendDmToParticipant: jest.fn().mockResolvedValue({ data: { dm_event_id: 'evt_1' } } as never),
            reply: jest.fn().mockResolvedValue({ data: { id: 'tweet_reply_1' } } as never),
        },
        v1: {
            uploadMedia: jest.fn().mockResolvedValue('media_id_1' as never),
        },
    })),
}))

jest.mock('axios', () => {
    const mockAxios = {
        get: jest.fn(),
        post: jest.fn(),
        isAxiosError: jest.fn().mockReturnValue(false),
    }
    return {
        __esModule: true,
        default: mockAxios,
        ...mockAxios,
    }
})

jest.mock('mime-types', () => ({
    lookup: jest.fn().mockReturnValue('image/jpeg'),
    extension: jest.fn().mockReturnValue('jpg'),
}))

jest.mock('fs/promises', () => ({
    writeFile: jest.fn(),
}))

describe('TwitterProvider', () => {
    const mockConfig = {
        name: 'twitter-test',
        port: 3000,
        appKey: 'test-app-key',
        appSecret: 'test-app-secret',
        accessToken: 'test-access-token',
        accessSecret: 'test-access-secret',
        webhookEnv: 'production',
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('Constructor', () => {
        it('should initialize with correct parameters', () => {
            const provider = new TwitterProvider(mockConfig)
            expect(provider).toBeDefined()
            expect(provider.globalVendorArgs.appKey).toBe(mockConfig.appKey)
            expect(provider.globalVendorArgs.appSecret).toBe(mockConfig.appSecret)
            expect(provider.globalVendorArgs.accessToken).toBe(mockConfig.accessToken)
            expect(provider.globalVendorArgs.accessSecret).toBe(mockConfig.accessSecret)
            expect(provider.globalVendorArgs.webhookEnv).toBe('production')
        })

        it('should throw error when no config provided', () => {
            expect(() => new TwitterProvider()).toThrow('Must provide Twitter App Key (API Key)')
        })

        it('should throw error when appKey is missing', () => {
            expect(() => new TwitterProvider({ ...mockConfig, appKey: undefined as any })).toThrow(
                'Must provide Twitter App Key (API Key)'
            )
        })

        it('should throw error when appSecret is missing', () => {
            expect(() => new TwitterProvider({ ...mockConfig, appSecret: undefined as any })).toThrow(
                'Must provide Twitter App Secret (API Secret)'
            )
        })

        it('should throw error when accessToken is missing', () => {
            expect(() => new TwitterProvider({ ...mockConfig, accessToken: undefined as any })).toThrow(
                'Must provide Twitter Access Token'
            )
        })

        it('should throw error when accessSecret is missing', () => {
            expect(() => new TwitterProvider({ ...mockConfig, accessSecret: undefined as any })).toThrow(
                'Must provide Twitter Access Token Secret'
            )
        })
    })

    describe('sendMessage', () => {
        let provider: TwitterProvider

        beforeEach(() => {
            provider = new TwitterProvider(mockConfig)
            // Manually inject a mock twitterClient
            ;(provider as any).twitterClient = {
                v2: {
                    me: jest.fn().mockResolvedValue({ data: { id: 'bot_123', username: 'bothandle' } }),
                    sendDmToParticipant: jest.fn().mockResolvedValue({ data: { dm_event_id: 'evt_1' } }),
                    reply: jest.fn().mockResolvedValue({ data: { id: 'tweet_reply_1' } }),
                },
                v1: {
                    uploadMedia: jest.fn().mockResolvedValue('media_id_1'),
                },
            }
        })

        it('should send a text DM successfully', async () => {
            const result = await provider.sendMessage('user_456', 'Hello!')

            expect((provider as any).twitterClient.v2.sendDmToParticipant).toHaveBeenCalledWith('user_456', {
                text: 'Hello!',
            })
            expect(result).toEqual({ data: { dm_event_id: 'evt_1' } })
        })

        it('should send media DM when mediaURL is provided', async () => {
            const axios = require('axios')
            axios.get.mockResolvedValue({
                data: Buffer.from('fake-image'),
                headers: { 'content-type': 'image/jpeg' },
            })

            await provider.sendMessage('user_456', 'Photo!', { mediaURL: 'https://example.com/img.jpg' })

            expect(axios.get).toHaveBeenCalledWith('https://example.com/img.jpg', { responseType: 'arraybuffer' })
            expect((provider as any).twitterClient.v1.uploadMedia).toHaveBeenCalled()
            expect((provider as any).twitterClient.v2.sendDmToParticipant).toHaveBeenCalledWith(
                'user_456',
                expect.objectContaining({
                    text: 'Photo!',
                    attachments: [{ media_id: 'media_id_1' }],
                })
            )
        })

        it('should throw when sending DM fails', async () => {
            ;(provider as any).twitterClient.v2.sendDmToParticipant = jest
                .fn()
                .mockRejectedValue(new Error('API Error'))

            await expect(provider.sendMessage('user_456', 'Hello')).rejects.toThrow('Failed to send Twitter DM')
        })
    })

    describe('replyToTweet', () => {
        let provider: TwitterProvider

        beforeEach(() => {
            provider = new TwitterProvider(mockConfig)
            ;(provider as any).twitterClient = {
                v2: {
                    reply: jest.fn().mockResolvedValue({ data: { id: 'tweet_reply_1' } }),
                },
            }
        })

        it('should reply to a tweet successfully', async () => {
            const result = await provider.replyToTweet('tweet_original', 'Great post!')

            expect((provider as any).twitterClient.v2.reply).toHaveBeenCalledWith('Great post!', 'tweet_original')
            expect(result).toEqual({ data: { id: 'tweet_reply_1' } })
        })

        it('should throw when reply fails', async () => {
            ;(provider as any).twitterClient.v2.reply = jest.fn().mockRejectedValue(new Error('API Error'))

            await expect(provider.replyToTweet('tweet_1', 'Reply')).rejects.toThrow('Failed to reply to tweet')
        })
    })

    describe('ctrlVerify', () => {
        let provider: TwitterProvider
        let mockRes: any

        beforeEach(() => {
            provider = new TwitterProvider(mockConfig)
            mockRes = {
                writeHead: jest.fn(),
                end: jest.fn(),
            }
        })

        it('should respond with HMAC-SHA256 for valid crc_token', () => {
            const crypto = require('crypto')
            const mockReq = { query: { crc_token: 'test_crc_token_123' } }

            ;(provider as any).ctrlVerify(mockReq, mockRes)

            expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
            const callArg = mockRes.end.mock.calls[0][0]
            const parsed = JSON.parse(callArg)
            expect(parsed.response_token).toMatch(/^sha256=/)

            // Verify the HMAC value is correct
            const expectedHmac = crypto
                .createHmac('sha256', mockConfig.appSecret)
                .update('test_crc_token_123')
                .digest('base64')
            expect(parsed.response_token).toBe(`sha256=${expectedHmac}`)
        })

        it('should return 400 when crc_token is missing', () => {
            const mockReq = { query: {} }

            ;(provider as any).ctrlVerify(mockReq, mockRes)

            expect(mockRes.writeHead).toHaveBeenCalledWith(400)
            expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ error: 'crc_token missing' }))
        })
    })

    describe('ctrlInMsg', () => {
        let provider: TwitterProvider
        let mockRes: any

        beforeEach(() => {
            provider = new TwitterProvider(mockConfig)
            provider.vendor = {
                eventInMsg: jest.fn(),
                emitter: {},
                emit: jest.fn(),
                on: jest.fn(),
                off: jest.fn(),
            } as any

            mockRes = { end: jest.fn() }
        })

        it('should forward body to vendor eventInMsg', () => {
            const mockReq = {
                body: {
                    for_user_id: 'bot_123',
                    direct_message_events: [],
                },
            }

            ;(provider as any).ctrlInMsg(mockReq, mockRes)

            expect(provider.vendor.eventInMsg).toHaveBeenCalledWith(mockReq.body)
            expect(mockRes.end).toHaveBeenCalledWith('EVENT_RECEIVED')
        })
    })

    describe('checkStatus', () => {
        let provider: TwitterProvider

        beforeEach(() => {
            provider = new TwitterProvider(mockConfig)
        })

        it('should emit ready when authentication succeeds', async () => {
            ;(provider as any).twitterClient = {
                v2: {
                    me: jest.fn().mockResolvedValue({ data: { id: 'bot_123', username: 'bothandle' } }),
                },
            }

            await provider.checkStatus()

            expect(provider.emit).toHaveBeenCalledWith('ready', true)
            expect((provider as any).botUserId).toBe('bot_123')
        })

        it('should emit auth_failure when authentication fails', async () => {
            ;(provider as any).twitterClient = {
                v2: {
                    me: jest.fn().mockRejectedValue(new Error('Unauthorized')),
                },
            }

            await provider.checkStatus()

            expect(provider.emit).toHaveBeenCalledWith(
                'auth_failure',
                expect.objectContaining({
                    title: '❌ TWITTER CONNECTION FAILED ❌',
                })
            )
        })
    })

    describe('saveFile', () => {
        let provider: TwitterProvider

        beforeEach(() => {
            provider = new TwitterProvider(mockConfig)
        })

        it('should return empty string if no media URL in context', async () => {
            const result = await provider.saveFile({ data: {} } as any)
            expect(result).toBe('')
        })

        it('should return empty string if ctx has no data', async () => {
            const result = await provider.saveFile({})
            expect(result).toBe('')
        })

        it('should download and save a media file', async () => {
            const axios = require('axios')
            const { writeFile } = require('fs/promises')
            axios.get.mockResolvedValue({
                data: Buffer.from('fake-image-data'),
                headers: { 'content-type': 'image/jpeg' },
            })
            writeFile.mockResolvedValue(undefined)

            const result = await provider.saveFile({
                data: { media: { url: 'https://pbs.twimg.com/media/img.jpg' } },
            } as any)

            expect(axios.get).toHaveBeenCalledWith('https://pbs.twimg.com/media/img.jpg', {
                responseType: 'arraybuffer',
            })
            expect(result).toMatch(/file-\d+\.jpg$/)
        })

        it('should return ERROR if download fails', async () => {
            const axios = require('axios')
            axios.get.mockRejectedValue(new Error('Download failed'))

            const result = await provider.saveFile({
                data: { media: { url: 'https://pbs.twimg.com/media/img.jpg' } },
            } as any)

            expect(result).toBe('ERROR')
        })
    })
})
