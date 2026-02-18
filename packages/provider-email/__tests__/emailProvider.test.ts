import { describe, expect, test, beforeEach, jest } from '@jest/globals'

import { EmailProvider } from '../src/email/provider'
import type { IEmailProviderArgs, EmailBotContext } from '../src/types'

const mockConfig: IEmailProviderArgs = {
    imap: {
        host: 'imap.example.com',
        port: 993,
        secure: true,
        auth: {
            user: 'test@example.com',
            pass: 'password123',
        },
    },
    smtp: {
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        auth: {
            user: 'test@example.com',
            pass: 'password123',
        },
    },
}

describe('EmailProvider', () => {
    describe('constructor', () => {
        test('should create instance with valid config', () => {
            const provider = new EmailProvider(mockConfig)
            expect(provider).toBeInstanceOf(EmailProvider)
            expect(provider.globalVendorArgs.imap).toBeDefined()
            expect(provider.globalVendorArgs.smtp).toBeDefined()
        })

        test('should throw error without IMAP config', () => {
            expect(() => {
                new EmailProvider({
                    smtp: mockConfig.smtp,
                } as IEmailProviderArgs)
            }).toThrow('IMAP configuration is required')
        })

        test('should throw error without SMTP config', () => {
            expect(() => {
                new EmailProvider({
                    imap: mockConfig.imap,
                } as IEmailProviderArgs)
            }).toThrow('SMTP configuration is required')
        })

        test('should throw error without IMAP auth', () => {
            expect(() => {
                new EmailProvider({
                    imap: {
                        host: 'imap.example.com',
                        port: 993,
                    } as any,
                    smtp: mockConfig.smtp,
                })
            }).toThrow('IMAP host and authentication are required')
        })

        test('should set default values', () => {
            const provider = new EmailProvider(mockConfig)
            expect(provider.globalVendorArgs.name).toBe('email-bot')
            expect(provider.globalVendorArgs.port).toBe(3000)
            expect(provider.globalVendorArgs.mailbox).toBe('INBOX')
            expect(provider.globalVendorArgs.markAsRead).toBe(true)
        })

        test('should allow overriding default values', () => {
            const provider = new EmailProvider({
                ...mockConfig,
                name: 'custom-bot',
                port: 4000,
                mailbox: 'Custom',
                markAsRead: false,
            })
            expect(provider.globalVendorArgs.name).toBe('custom-bot')
            expect(provider.globalVendorArgs.port).toBe(4000)
            expect(provider.globalVendorArgs.mailbox).toBe('Custom')
            expect(provider.globalVendorArgs.markAsRead).toBe(false)
        })
    })

    describe('helper methods', () => {
        let provider: EmailProvider

        beforeEach(() => {
            provider = new EmailProvider(mockConfig)
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
        let provider: EmailProvider

        // Helper to create a mock sendEmail function
        const createMockSendEmail = () => {
            const fn = jest.fn()
            fn.mockImplementation(() => Promise.resolve({ messageId: '<reply@example.com>' }))
            return fn
        }

        beforeEach(() => {
            provider = new EmailProvider(mockConfig)
        })

        test('busEvents should store context in conversationContexts Map', () => {
            const busEvents = provider['busEvents']()
            const messageHandler = busEvents.find((e) => e.event === 'message')

            expect(messageHandler).toBeDefined()

            const mockPayload: EmailBotContext = {
                from: 'user@example.com',
                name: 'Test User',
                body: 'Hello',
                subject: 'Test Subject',
                messageId: '<msg123@example.com>',
                threadId: '<thread123@example.com>',
                isReply: false,
                uid: 1,
            }

            // Call the message handler
            messageHandler!.func(mockPayload)

            // Check that context was stored
            const storedContext = (provider as any).conversationContexts.get('user@example.com')
            expect(storedContext).toBeDefined()
            expect(storedContext.messageId).toBe('<msg123@example.com>')
            expect(storedContext.subject).toBe('Test Subject')
        })

        test('sendMessage should use stored context for inReplyTo', async () => {
            // Setup: store a context
            const mockContext: EmailBotContext = {
                from: 'user@example.com',
                name: 'Test User',
                body: 'Hello',
                subject: 'Original Subject',
                messageId: '<original@example.com>',
                threadId: '<thread@example.com>',
                isReply: false,
                uid: 1,
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
                    inReplyTo: '<original@example.com>',
                })
            )
        })

        test('sendMessage should add Re: prefix to subject', async () => {
            const mockContext: EmailBotContext = {
                from: 'user@example.com',
                name: 'Test User',
                body: 'Hello',
                subject: 'Question about product',
                messageId: '<msg@example.com>',
                threadId: '<thread@example.com>',
                isReply: false,
                uid: 1,
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

        test('sendMessage should include references header', async () => {
            const mockContext: EmailBotContext = {
                from: 'user@example.com',
                name: 'Test User',
                body: 'Hello',
                subject: 'Thread test',
                messageId: '<msg@example.com>',
                threadId: '<thread-start@example.com>',
                isReply: false,
                uid: 1,
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
                    references: ['<thread-start@example.com>'],
                })
            )
        })

        test('sendMessage should not add Re: if already present', async () => {
            const mockContext: EmailBotContext = {
                from: 'user@example.com',
                name: 'Test User',
                body: 'Hello',
                subject: 'Re: Already a reply',
                messageId: '<msg@example.com>',
                threadId: '<thread@example.com>',
                isReply: true,
                uid: 1,
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
            const mockContext: EmailBotContext = {
                from: 'user@example.com',
                name: 'Test User',
                body: 'Hello',
                subject: 'Original',
                messageId: '<msg@example.com>',
                threadId: '<thread@example.com>',
                isReply: false,
                uid: 1,
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
