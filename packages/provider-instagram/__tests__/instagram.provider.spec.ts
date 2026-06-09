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
    utils: {
        generalDownload: jest.fn<(url: string) => Promise<string>>().mockResolvedValue('/tmp/downloaded-file.jpg'),
    },
}))

jest.mock('../src/instagram.events', () => ({
    InstagramEvents: jest.fn().mockImplementation(() => ({
        eventInMsg: jest.fn(),
        setListenMode: jest.fn(),
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

jest.mock('fs', () => ({
    createReadStream: jest.fn().mockReturnValue('mock-read-stream'),
    existsSync: jest.fn().mockReturnValue(true),
}))

jest.mock('form-data', () => {
    return jest.fn().mockImplementation(() => ({
        append: jest.fn(),
        getHeaders: jest.fn().mockReturnValue({ 'content-type': 'multipart/form-data' }),
    }))
})

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

        it('should default listenMode to message', () => {
            const provider = new InstagramProvider(mockConfig)
            expect(provider.globalVendorArgs.listenMode).toBe('message')
        })

        it('should accept listenMode configuration', () => {
            const provider = new InstagramProvider({ ...mockConfig, listenMode: 'both' })
            expect(provider.globalVendorArgs.listenMode).toBe('both')
        })

        it('should accept comment listenMode', () => {
            const provider = new InstagramProvider({ ...mockConfig, listenMode: 'comment' })
            expect(provider.globalVendorArgs.listenMode).toBe('comment')
        })
    })

    describe('sendText', () => {
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

            const result = await provider.sendText('user123', 'Hello World')

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

        it('should handle send text error', async () => {
            const axios = require('axios')
            axios.post.mockRejectedValue({
                response: { data: 'API Error' },
                message: 'Network error',
            })

            await expect(provider.sendText('user123', 'Hello')).rejects.toThrow('Failed to send message')
        })

        it('should return null and emit window_expired when 24h window is closed (error code 10)', async () => {
            const axios = require('axios')
            axios.post.mockRejectedValue({
                response: {
                    data: {
                        error: {
                            message: 'This message is sent outside of allowed window.',
                            type: 'IGApiException',
                            code: 10,
                            error_subcode: 2534022,
                        },
                    },
                },
            })

            const result = await provider.sendText('user123', 'Hello')

            expect(result).toBeNull()
            expect(provider.emit).toHaveBeenCalledWith('window_expired', { userId: 'user123', message: 'Hello' })
        })

        it('should return null and emit window_expired when error_subcode is 2534022', async () => {
            const axios = require('axios')
            axios.post.mockRejectedValue({
                response: {
                    data: {
                        error: {
                            code: 10,
                            error_subcode: 2534022,
                        },
                    },
                },
            })

            const result = await provider.sendText('user456', 'Test message')

            expect(result).toBeNull()
            expect(provider.emit).toHaveBeenCalledWith('window_expired', {
                userId: 'user456',
                message: 'Test message',
            })
        })
    })

    describe('sendMessage', () => {
        let provider: InstagramProvider

        beforeEach(() => {
            provider = new InstagramProvider(mockConfig)
        })

        it('should send text message when no media option', async () => {
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

        it('should call sendMedia when media option is provided', async () => {
            const axios = require('axios')
            const mime = require('mime-types')
            mime.lookup.mockReturnValue('image/jpeg')

            // Mock for upload attachment
            axios.post.mockResolvedValueOnce({
                status: 200,
                data: { attachment_id: 'attach_123' },
            })
            // Mock for send attachment
            axios.post.mockResolvedValueOnce({
                status: 200,
                data: { message_id: 'msg_123' },
            })

            const result = await provider.sendMessage('user123', 'Check this image', {
                media: 'https://example.com/image.jpg',
            })

            expect(result).toBeDefined()
        })

        it('should handle send message error', async () => {
            const axios = require('axios')
            axios.post.mockRejectedValue({
                response: { data: 'API Error' },
                message: 'Network error',
            })

            await expect(provider.sendMessage('user123', 'Hello')).rejects.toThrow('Failed to send message')
        })

        it('should call sendPrivateReply when options.comment.id is provided', async () => {
            const axios = require('axios')
            axios.post.mockResolvedValue({
                status: 200,
                data: { message_id: 'msg_private' },
            })

            const result = await provider.sendMessage('user123', 'Hi from bot', { comment: { id: 'comment_abc' } })

            expect(axios.post).toHaveBeenCalledWith(
                `https://graph.instagram.com/${mockConfig.version}/me/messages`,
                expect.objectContaining({
                    recipient: { comment_id: 'comment_abc' },
                    message: { text: 'Hi from bot' },
                })
            )
            expect(result).toEqual({ message_id: 'msg_private' })
        })

        it('should auto-route to sendPrivateReply when pendingComments has an entry for the user', async () => {
            const axios = require('axios')
            axios.post.mockResolvedValue({
                status: 200,
                data: { message_id: 'msg_auto_private' },
            })
            ;(provider as any).pendingComments.set('user_commenter', {
                commentId: 'comment_xyz',
                timestamp: Date.now(),
            })

            const result = await provider.sendMessage('user_commenter', 'Thanks for commenting!')

            expect(axios.post).toHaveBeenCalledWith(
                `https://graph.instagram.com/${mockConfig.version}/me/messages`,
                expect.objectContaining({
                    recipient: { comment_id: 'comment_xyz' },
                    message: { text: 'Thanks for commenting!' },
                })
            )
            expect(result).toEqual({ message_id: 'msg_auto_private' })
        })

        it('should consume pending comment only once (second send uses sendText)', async () => {
            const axios = require('axios')
            axios.post.mockResolvedValue({
                status: 200,
                data: { message_id: 'msg_follow_up' },
            })
            ;(provider as any).pendingComments.set('user_once', {
                commentId: 'comment_once',
                timestamp: Date.now(),
            })

            await provider.sendMessage('user_once', 'First reply via Private Reply')
            await provider.sendMessage('user_once', 'Second reply via DM')

            const calls = axios.post.mock.calls
            expect(calls[0][1]).toMatchObject({ recipient: { comment_id: 'comment_once' } })
            expect(calls[1][1]).toMatchObject({ recipient: { id: 'user_once' } })
        })
    })

    describe('sendMedia', () => {
        let provider: InstagramProvider

        beforeEach(() => {
            provider = new InstagramProvider(mockConfig)
            jest.clearAllMocks()
        })

        it('should send image when mime type is image', async () => {
            const axios = require('axios')
            const mime = require('mime-types')
            mime.lookup.mockReturnValue('image/jpeg')

            // Mock for upload attachment
            axios.post.mockResolvedValueOnce({
                status: 200,
                data: { attachment_id: 'attach_123' },
            })
            // Mock for send attachment
            axios.post.mockResolvedValueOnce({
                status: 200,
                data: { message_id: 'msg_123' },
            })

            const result = await provider.sendMedia('user123', '', 'https://example.com/image.jpg')

            expect(result).toEqual({ message_id: 'msg_123' })
        })

        it('should send video when mime type is video', async () => {
            const axios = require('axios')
            const mime = require('mime-types')
            mime.lookup.mockReturnValue('video/mp4')

            // Mock for upload attachment
            axios.post.mockResolvedValueOnce({
                status: 200,
                data: { attachment_id: 'attach_123' },
            })
            // Mock for send attachment
            axios.post.mockResolvedValueOnce({
                status: 200,
                data: { message_id: 'msg_123' },
            })

            const result = await provider.sendMedia('user123', '', 'https://example.com/video.mp4')

            expect(result).toEqual({ message_id: 'msg_123' })
        })

        it('should send audio when mime type is audio', async () => {
            const axios = require('axios')
            const mime = require('mime-types')
            mime.lookup.mockReturnValue('audio/mp3')

            // Mock for upload attachment
            axios.post.mockResolvedValueOnce({
                status: 200,
                data: { attachment_id: 'attach_123' },
            })
            // Mock for send attachment
            axios.post.mockResolvedValueOnce({
                status: 200,
                data: { message_id: 'msg_123' },
            })

            const result = await provider.sendMedia('user123', '', 'https://example.com/audio.mp3')

            expect(result).toEqual({ message_id: 'msg_123' })
        })

        it('should warn and return when file type is not supported', async () => {
            const axios = require('axios')
            const mime = require('mime-types')
            mime.lookup.mockReturnValue('application/pdf')

            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

            const result = await provider.sendMedia('user123', '', 'https://example.com/file.pdf')

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('File type not supported'),
                expect.any(Object)
            )
            expect(result).toEqual({ warning: 'Unsupported file type, no message sent' })

            consoleSpy.mockRestore()
        })

        it('should send text when file type not supported but text is provided', async () => {
            const axios = require('axios')
            const mime = require('mime-types')
            mime.lookup.mockReturnValue('application/pdf')

            axios.post.mockResolvedValue({
                status: 200,
                data: { message_id: 'msg_text' },
            })

            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

            const result = await provider.sendMedia('user123', 'Here is a file', 'https://example.com/file.pdf')

            expect(consoleSpy).toHaveBeenCalled()
            expect(result).toEqual({ message_id: 'msg_text' })

            consoleSpy.mockRestore()
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
            ;(provider as any).ctrlInMsg(mockReq, mockRes)

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

    describe('replyComment', () => {
        let provider: InstagramProvider

        beforeEach(() => {
            provider = new InstagramProvider(mockConfig)
        })

        it('should reply to a comment successfully', async () => {
            const axios = require('axios')
            axios.post.mockResolvedValue({
                status: 200,
                data: { id: 'reply_123' },
            })

            const result = await provider.replyComment('comment_456', 'Thanks for your comment!')

            expect(axios.post).toHaveBeenCalledWith(
                `https://graph.facebook.com/${mockConfig.version}/comment_456/replies`,
                expect.objectContaining({
                    message: 'Thanks for your comment!',
                    access_token: mockConfig.accessToken,
                })
            )
            expect(result).toEqual({ id: 'reply_123' })
        })

        it('should handle reply comment error', async () => {
            const axios = require('axios')
            axios.post.mockRejectedValue({
                response: { data: 'API Error' },
                message: 'Network error',
            })

            await expect(provider.replyComment('comment_456', 'Reply')).rejects.toThrow('Failed to reply to comment')
        })
    })

    describe('sendPrivateReply', () => {
        let provider: InstagramProvider

        beforeEach(() => {
            provider = new InstagramProvider(mockConfig)
        })

        it('should send a private reply DM using comment_id as recipient', async () => {
            const axios = require('axios')
            axios.post.mockResolvedValue({
                status: 200,
                data: { message_id: 'msg_789' },
            })

            const result = await provider.sendPrivateReply('comment_456', 'Hey, saw your comment!')

            expect(axios.post).toHaveBeenCalledWith(
                `https://graph.instagram.com/${mockConfig.version}/me/messages`,
                expect.objectContaining({
                    recipient: { comment_id: 'comment_456' },
                    message: { text: 'Hey, saw your comment!' },
                    access_token: mockConfig.accessToken,
                })
            )
            expect(result).toEqual({ message_id: 'msg_789' })
        })

        it('should handle private reply error', async () => {
            const axios = require('axios')
            axios.post.mockRejectedValue({
                response: { data: 'API Error' },
                message: 'Network error',
            })

            await expect(provider.sendPrivateReply('comment_456', 'Hey!')).rejects.toThrow(
                'Failed to send private reply'
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
