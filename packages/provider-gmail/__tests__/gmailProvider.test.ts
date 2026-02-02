import { describe, expect, test, beforeEach, jest } from '@jest/globals'

// Mock @builderbot/bot before importing GmailProvider
jest.mock('@builderbot/bot', () => {
    const EventEmitter = require('node:events')
    return {
        ProviderClass: class MockProviderClass extends EventEmitter {},
        utils: {
            generateRefProvider: jest.fn((event: string) => `REF:${event}`),
        },
    }
})

import { GmailProvider } from '../src/gmail/provider'
import type { IGmailProviderArgs, GmailBotContext } from '../src/types'

const mockConfig: IGmailProviderArgs = {
    email: 'test@gmail.com',
    oauth2: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token',
    },
}

describe('GmailProvider', () => {
    describe('constructor', () => {
        test('should create instance with valid config', () => {
            const provider = new GmailProvider(mockConfig)
            expect(provider).toBeInstanceOf(GmailProvider)
            expect(provider.globalVendorArgs.email).toBe('test@gmail.com')
            expect(provider.globalVendorArgs.oauth2).toBeDefined()
        })

        test('should throw error without email', () => {
            expect(() => {
                new GmailProvider({
                    oauth2: mockConfig.oauth2,
                } as IGmailProviderArgs)
            }).toThrow('Gmail email address is required')
        })

        test('should throw error without OAuth2 config', () => {
            expect(() => {
                new GmailProvider({
                    email: 'test@gmail.com',
                } as IGmailProviderArgs)
            }).toThrow('OAuth2 configuration is required')
        })

        test('should throw error without OAuth2 clientId', () => {
            expect(() => {
                new GmailProvider({
                    email: 'test@gmail.com',
                    oauth2: {
                        clientSecret: 'secret',
                        refreshToken: 'token',
                    } as any,
                })
            }).toThrow('OAuth2 clientId, clientSecret, and refreshToken are required')
        })

        test('should throw error without OAuth2 clientSecret', () => {
            expect(() => {
                new GmailProvider({
                    email: 'test@gmail.com',
                    oauth2: {
                        clientId: 'id',
                        refreshToken: 'token',
                    } as any,
                })
            }).toThrow('OAuth2 clientId, clientSecret, and refreshToken are required')
        })

        test('should throw error without OAuth2 refreshToken', () => {
            expect(() => {
                new GmailProvider({
                    email: 'test@gmail.com',
                    oauth2: {
                        clientId: 'id',
                        clientSecret: 'secret',
                    } as any,
                })
            }).toThrow('OAuth2 clientId, clientSecret, and refreshToken are required')
        })

        test('should set default values', () => {
            const provider = new GmailProvider(mockConfig)
            expect(provider.globalVendorArgs.name).toBe('gmail-bot')
            expect(provider.globalVendorArgs.port).toBe(3000)
            expect(provider.globalVendorArgs.label).toBe('INBOX')
            expect(provider.globalVendorArgs.markAsRead).toBe(true)
            expect(provider.globalVendorArgs.pollingInterval).toBe(10000)
        })

        test('should allow overriding default values', () => {
            const provider = new GmailProvider({
                ...mockConfig,
                name: 'custom-bot',
                port: 4000,
                label: 'Custom',
                markAsRead: false,
                pollingInterval: 5000,
            })
            expect(provider.globalVendorArgs.name).toBe('custom-bot')
            expect(provider.globalVendorArgs.port).toBe(4000)
            expect(provider.globalVendorArgs.label).toBe('Custom')
            expect(provider.globalVendorArgs.markAsRead).toBe(false)
            expect(provider.globalVendorArgs.pollingInterval).toBe(5000)
        })
    })

    describe('helper methods', () => {
        let provider: GmailProvider

        beforeEach(() => {
            provider = new GmailProvider(mockConfig)
        })

        test('isReply should return correct value', () => {
            expect(provider.isReply({ isReply: true } as any)).toBe(true)
            expect(provider.isReply({ isReply: false } as any)).toBe(false)
        })

        test('getThreadId should return threadId', () => {
            expect(provider.getThreadId({ threadId: 'test-thread' } as any)).toBe('test-thread')
            expect(provider.getThreadId({} as any)).toBeUndefined()
        })

        test('getAttachments should return attachments array', () => {
            const attachments = [{ filename: 'test.txt', contentType: 'text/plain', size: 100 }]
            expect(provider.getAttachments({ attachments } as any)).toEqual(attachments)
            expect(provider.getAttachments({} as any)).toEqual([])
        })
    })

    describe('thread replies', () => {
        let provider: GmailProvider

        // Helper to create a mock sendEmail function
        const createMockSendEmail = () => {
            const fn = jest.fn()
            fn.mockImplementation(() => Promise.resolve({ messageId: 'reply-id', threadId: 'thread-id' }))
            return fn
        }

        beforeEach(() => {
            provider = new GmailProvider(mockConfig)
        })

        test('busEvents should store context in conversationContexts Map', () => {
            const busEvents = provider['busEvents']()
            const messageHandler = busEvents.find((e) => e.event === 'message')

            expect(messageHandler).toBeDefined()

            const mockPayload: GmailBotContext = {
                from: 'user@example.com',
                name: 'Test User',
                body: 'Hello',
                subject: 'Test Subject',
                messageId: '<msg123@gmail.com>',
                threadId: 'thread123',
                isReply: false,
                gmailId: 'gmail123',
            }

            // Call the message handler
            messageHandler!.func(mockPayload)

            // Check that context was stored
            const storedContext = (provider as any).conversationContexts.get('user@example.com')
            expect(storedContext).toBeDefined()
            expect(storedContext.messageId).toBe('<msg123@gmail.com>')
            expect(storedContext.subject).toBe('Test Subject')
            expect(storedContext.threadId).toBe('thread123')
        })

        test('sendMessage should use stored context for inReplyTo', async () => {
            // Setup: store a context
            const mockContext: GmailBotContext = {
                from: 'user@example.com',
                name: 'Test User',
                body: 'Hello',
                subject: 'Original Subject',
                messageId: '<original@gmail.com>',
                threadId: 'thread123',
                isReply: false,
                gmailId: 'gmail123',
            }
            ;(provider as any).conversationContexts.set('user@example.com', mockContext)

            // Mock vendor.sendEmail
            const mockSendEmail = createMockSendEmail()
            ;(provider as any).vendor = { sendEmail: mockSendEmail }

            // Call sendMessage
            await provider.sendMessage('user@example.com', 'Reply message')

            // Verify sendEmail was called with correct inReplyTo
            expect(mockSendEmail).toHaveBeenCalledWith(
                'user@example.com',
                'Re: Original Subject',
                'Reply message',
                expect.objectContaining({
                    inReplyTo: '<original@gmail.com>',
                    threadId: 'thread123',
                })
            )
        })

        test('sendMessage should add Re: prefix to subject', async () => {
            const mockContext: GmailBotContext = {
                from: 'user@example.com',
                name: 'Test User',
                body: 'Hello',
                subject: 'Question about product',
                messageId: '<msg@gmail.com>',
                threadId: 'thread123',
                isReply: false,
                gmailId: 'gmail123',
            }
            ;(provider as any).conversationContexts.set('user@example.com', mockContext)

            const mockSendEmail = createMockSendEmail()
            ;(provider as any).vendor = { sendEmail: mockSendEmail }

            await provider.sendMessage('user@example.com', 'Here is the answer')

            expect(mockSendEmail).toHaveBeenCalledWith(
                'user@example.com',
                'Re: Question about product',
                'Here is the answer',
                expect.any(Object)
            )
        })

        test('sendMessage should include references and threadId', async () => {
            const mockContext: GmailBotContext = {
                from: 'user@example.com',
                name: 'Test User',
                body: 'Hello',
                subject: 'Thread test',
                messageId: '<msg@gmail.com>',
                threadId: 'thread-start-id',
                isReply: false,
                gmailId: 'gmail123',
            }
            ;(provider as any).conversationContexts.set('user@example.com', mockContext)

            const mockSendEmail = createMockSendEmail()
            ;(provider as any).vendor = { sendEmail: mockSendEmail }

            await provider.sendMessage('user@example.com', 'Following up')

            expect(mockSendEmail).toHaveBeenCalledWith(
                'user@example.com',
                expect.any(String),
                'Following up',
                expect.objectContaining({
                    references: ['thread-start-id'],
                    threadId: 'thread-start-id',
                })
            )
        })

        test('sendMessage should not add Re: if already present', async () => {
            const mockContext: GmailBotContext = {
                from: 'user@example.com',
                name: 'Test User',
                body: 'Hello',
                subject: 'Re: Already a reply',
                messageId: '<msg@gmail.com>',
                threadId: 'thread123',
                isReply: true,
                gmailId: 'gmail123',
            }
            ;(provider as any).conversationContexts.set('user@example.com', mockContext)

            const mockSendEmail = createMockSendEmail()
            ;(provider as any).vendor = { sendEmail: mockSendEmail }

            await provider.sendMessage('user@example.com', 'Continuing the thread')

            // Should NOT have "Re: Re:"
            expect(mockSendEmail).toHaveBeenCalledWith(
                'user@example.com',
                'Re: Already a reply', // Not "Re: Re: Already a reply"
                'Continuing the thread',
                expect.any(Object)
            )
        })

        test('sendMessage without context should use default subject', async () => {
            // No context stored for this user
            const mockSendEmail = createMockSendEmail()
            ;(provider as any).vendor = { sendEmail: mockSendEmail }

            await provider.sendMessage('newuser@example.com', 'Hello!')

            expect(mockSendEmail).toHaveBeenCalledWith(
                'newuser@example.com',
                'Message from Bot',
                'Hello!',
                expect.objectContaining({
                    inReplyTo: undefined,
                })
            )
        })

        test('sendMessage should allow custom subject override', async () => {
            const mockContext: GmailBotContext = {
                from: 'user@example.com',
                name: 'Test User',
                body: 'Hello',
                subject: 'Original',
                messageId: '<msg@gmail.com>',
                threadId: 'thread123',
                isReply: false,
                gmailId: 'gmail123',
            }
            ;(provider as any).conversationContexts.set('user@example.com', mockContext)

            const mockSendEmail = createMockSendEmail()
            ;(provider as any).vendor = { sendEmail: mockSendEmail }

            await provider.sendMessage('user@example.com', 'Custom message', {
                subject: 'Custom Subject',
            })

            // Custom subject should be used with Re: prefix since there's context
            expect(mockSendEmail).toHaveBeenCalledWith(
                'user@example.com',
                'Re: Custom Subject',
                'Custom message',
                expect.any(Object)
            )
        })
    })
})
