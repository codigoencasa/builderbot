import { beforeEach, describe, expect, jest, it } from '@jest/globals'

import { InstagramProvider } from '../src/instagram.provider'

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

jest.mock('../src/instagram.events', () => ({
    InstagramEvents: jest.fn().mockImplementation(() => ({
        eventInMsg: jest.fn(),
        emitter: {},
        emit: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
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

describe('InstagramProvider', () => {
    const mockConfig = {
        name: 'instagram-test',
        port: 3000,
        accessToken: 'test-access-token',
        igAccountId: 'test-ig-account-id',
        version: 'v19.0',
        verifyToken: 'test-verify-token',
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('Constructor', () => {
        it('should initialize with correct parameters', () => {
            const provider = new InstagramProvider(mockConfig)
            expect(provider).toBeDefined()
            expect(provider.globalVendorArgs.accessToken).toBe(mockConfig.accessToken)
            expect(provider.globalVendorArgs.igAccountId).toBe(mockConfig.igAccountId)
            expect(provider.globalVendorArgs.verifyToken).toBe(mockConfig.verifyToken)
            expect(provider.globalVendorArgs.name).toBe(mockConfig.name)
            expect(provider.globalVendorArgs.port).toBe(mockConfig.port)
        })

        it('should use default values when no config provided', () => {
            expect(() => new InstagramProvider()).toThrow('Must provide Instagram Access Token')
        })

        it('should throw error when accessToken is missing', () => {
            expect(() => new InstagramProvider({ ...mockConfig, accessToken: undefined as any })).toThrow(
                'Must provide Instagram Access Token'
            )
        })

        it('should throw error when igAccountId is missing', () => {
            expect(() => new InstagramProvider({ ...mockConfig, igAccountId: undefined as any })).toThrow(
                'Must provide Instagram Account ID'
            )
        })

        it('should throw error when verifyToken is missing', () => {
            expect(() => new InstagramProvider({ ...mockConfig, verifyToken: undefined as any })).toThrow(
                'Must provide Instagram Verify Token'
            )
        })
    })

    describe('sendMessage', () => {
        let provider: InstagramProvider

        beforeEach(() => {
            provider = new InstagramProvider(mockConfig)
        })

        it('should send text message successfully', async () => {
            const axios = require('axios')
            axios.post.mockResolvedValue({
                status: 200,
                data: { message_id: 'msg_123' },
            })

            const result = await provider.sendMessage('user123', 'Hello World')

            expect(axios.post).toHaveBeenCalledWith(
                `https://graph.instagram.com/${mockConfig.version}/${mockConfig.igAccountId}/messages`,
                expect.objectContaining({
                    recipient: { id: 'user123' },
                    message: { text: 'Hello World' },
                    access_token: mockConfig.accessToken,
                })
            )
            expect(result).toEqual({ message_id: 'msg_123' })
        })

        it('should handle send message error', async () => {
            const axios = require('axios')
            axios.post.mockRejectedValue({
                response: { data: 'API Error' },
                message: 'Network error',
            })

            await expect(provider.sendMessage('user123', 'Hello')).rejects.toThrow('Failed to send message')
        })
    })

    describe('sendImage', () => {
        let provider: InstagramProvider

        beforeEach(() => {
            provider = new InstagramProvider(mockConfig)
        })

        it('should send image successfully', async () => {
            const axios = require('axios')
            axios.post.mockResolvedValue({
                status: 200,
                data: { message_id: 'msg_123' },
            })

            const result = await provider.sendImage('user123', 'https://example.com/image.jpg')

            expect(axios.post).toHaveBeenCalledWith(
                `https://graph.instagram.com/${mockConfig.version}/${mockConfig.igAccountId}/messages`,
                expect.objectContaining({
                    recipient: { id: 'user123' },
                    message: {
                        attachment: {
                            type: 'image',
                            payload: {
                                url: 'https://example.com/image.jpg',
                                is_reusable: true,
                            },
                        },
                    },
                    access_token: mockConfig.accessToken,
                })
            )
            expect(result).toEqual({ message_id: 'msg_123' })
        })
    })

    describe('sendQuickReplies', () => {
        let provider: InstagramProvider

        beforeEach(() => {
            provider = new InstagramProvider(mockConfig)
        })

        it('should send quick replies successfully', async () => {
            const axios = require('axios')
            axios.post.mockResolvedValue({
                status: 200,
                data: { message_id: 'msg_123' },
            })

            const quickReplies = [
                { content_type: 'text', title: 'Yes', payload: 'YES' },
                { content_type: 'text', title: 'No', payload: 'NO' },
            ]

            const result = await provider.sendQuickReplies('user123', 'Choose:', quickReplies)

            expect(axios.post).toHaveBeenCalledWith(
                `https://graph.instagram.com/${mockConfig.version}/${mockConfig.igAccountId}/messages`,
                expect.objectContaining({
                    recipient: { id: 'user123' },
                    message: {
                        text: 'Choose:',
                        quick_replies: quickReplies,
                    },
                })
            )
            expect(result).toEqual({ message_id: 'msg_123' })
        })
    })

    describe('ctrlInMsg', () => {
        let provider: InstagramProvider
        let mockReq: any
        let mockRes: any

        beforeEach(() => {
            provider = new InstagramProvider(mockConfig)
            provider.vendor = {
                eventInMsg: jest.fn(),
                emitter: {},
                emit: jest.fn(),
                on: jest.fn(),
                off: jest.fn(),
            } as any

            mockReq = {
                body: {
                    entry: [
                        {
                            id: 'ig_123',
                            time: Date.now(),
                            messaging: [
                                {
                                    sender: { id: 'user123' },
                                    recipient: { id: 'ig123' },
                                    timestamp: Date.now(),
                                    message: {
                                        mid: 'msg123',
                                        text: 'Hello',
                                    },
                                },
                            ],
                        },
                    ],
                },
            }

            mockRes = {
                end: jest.fn(),
            }
        })

        it('should process incoming webhook correctly', () => {
            (provider as any).ctrlInMsg(mockReq, mockRes)

            expect(provider.vendor.eventInMsg).toHaveBeenCalledWith(mockReq.body)
            expect(mockRes.end).toHaveBeenCalledWith('EVENT_RECEIVED')
        })
    })

    describe('ctrlVerify', () => {
        let provider: InstagramProvider
        let mockReq: any
        let mockRes: any

        beforeEach(() => {
            provider = new InstagramProvider(mockConfig)
            mockRes = {
                end: jest.fn(),
            }
        })

        it('should verify webhook with correct token', () => {
            mockReq = {
                query: {
                    'hub.mode': 'subscribe',
                    'hub.verify_token': 'test-verify-token',
                    'hub.challenge': 'challenge123',
                },
            }
            ;(provider as any).ctrlVerify(mockReq, mockRes)
            expect(mockRes.end).toHaveBeenCalledWith('challenge123')
        })

        it('should reject webhook with incorrect token', () => {
            mockReq = {
                query: {
                    'hub.mode': 'subscribe',
                    'hub.verify_token': 'wrong-token',
                    'hub.challenge': 'challenge123',
                },
            }
            ;(provider as any).ctrlVerify(mockReq, mockRes)
            expect(mockRes.end).toHaveBeenCalledWith('ERROR')
        })
    })

    describe('checkStatus', () => {
        let provider: InstagramProvider

        beforeEach(() => {
            provider = new InstagramProvider(mockConfig)
        })

        it('should verify API connection successfully', async () => {
            const axios = require('axios')
            axios.get.mockResolvedValue({ status: 200 })

            await provider.checkStatus()

            expect(axios.get).toHaveBeenCalledWith(
                `https://graph.instagram.com/${mockConfig.version}/me?fields=id,username&access_token=${mockConfig.accessToken}`
            )
            expect(provider.emit).toHaveBeenCalledWith('ready', true)
        })

        it('should handle API connection error', async () => {
            const axios = require('axios')
            axios.get.mockRejectedValue(new Error('Connection failed'))

            await provider.checkStatus()

            expect(provider.emit).toHaveBeenCalledWith(
                'auth_failure',
                expect.objectContaining({
                    title: '❌ CONNECTION FAILED ❌',
                })
            )
        })
    })

    describe('saveFile', () => {
        let provider: InstagramProvider

        beforeEach(() => {
            provider = new InstagramProvider(mockConfig)
        })

        it('should return empty string if no media URL', async () => {
            const mockCtx = {
                data: {},
            } as any

            const result = await provider.saveFile(mockCtx)
            expect(result).toBe('')
        })
    })
})
