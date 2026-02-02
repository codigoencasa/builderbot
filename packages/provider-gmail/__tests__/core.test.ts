import { describe, expect, test, jest, beforeEach } from '@jest/globals'
import type { gmail_v1 } from 'googleapis'

// Mock @builderbot/bot before importing GmailCoreVendor
jest.mock('@builderbot/bot', () => ({
    ProviderClass: class MockProviderClass {},
    utils: {
        generateRefProvider: jest.fn((event: string) => `REF:${event}`),
    },
}))

import { GmailCoreVendor } from '../src/gmail/core'
import type { IGmailProviderArgs, GmailBotContext } from '../src/types'

const mockConfig: IGmailProviderArgs = {
    email: 'test@gmail.com',
    oauth2: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token',
    },
}

/**
 * Helper to create a mock Gmail API message
 */
const createMockGmailMessage = (options: {
    text?: string
    html?: string
    attachments?: Array<{
        filename: string
        mimeType: string
        size?: number
        attachmentId?: string
    }>
    from?: string
    to?: string
    subject?: string
    messageId?: string
    threadId?: string
    inReplyTo?: string
    references?: string
    labelIds?: string[]
}): gmail_v1.Schema$Message => {
    const headers: gmail_v1.Schema$MessagePartHeader[] = [
        { name: 'From', value: options.from || 'Test Sender <sender@example.com>' },
        { name: 'To', value: options.to || 'recipient@example.com' },
        { name: 'Subject', value: options.subject !== undefined ? options.subject : 'Test Subject' },
        { name: 'Message-ID', value: options.messageId || '<test123@gmail.com>' },
        { name: 'Date', value: new Date().toISOString() },
    ]

    if (options.inReplyTo) {
        headers.push({ name: 'In-Reply-To', value: options.inReplyTo })
    }
    if (options.references) {
        headers.push({ name: 'References', value: options.references })
    }

    const parts: gmail_v1.Schema$MessagePart[] = []

    if (options.text) {
        parts.push({
            mimeType: 'text/plain',
            body: {
                data: Buffer.from(options.text).toString('base64url'),
            },
        })
    }

    if (options.html) {
        parts.push({
            mimeType: 'text/html',
            body: {
                data: Buffer.from(options.html).toString('base64url'),
            },
        })
    }

    if (options.attachments) {
        for (const att of options.attachments) {
            parts.push({
                filename: att.filename,
                mimeType: att.mimeType,
                body: {
                    attachmentId: att.attachmentId || 'att-id-123',
                    size: att.size || 100,
                },
            })
        }
    }

    return {
        id: 'gmail-msg-id',
        threadId: options.threadId || 'thread-id-123',
        labelIds: options.labelIds || ['INBOX'],
        payload: {
            headers: headers,
            mimeType: parts.length > 1 ? 'multipart/mixed' : 'text/plain',
            parts: parts.length > 0 ? parts : undefined,
            body: parts.length === 0 && options.text ? {
                data: Buffer.from(options.text || '').toString('base64url'),
            } : undefined,
        },
    }
}

describe('GmailCoreVendor', () => {
    let vendor: GmailCoreVendor

    beforeEach(() => {
        jest.clearAllMocks()
        vendor = new GmailCoreVendor(mockConfig)
    })

    describe('parseMessageToContext - event detection', () => {
        test('should generate _event_media_ for image attachments', () => {
            const message = createMockGmailMessage({
                text: 'Hello',
                attachments: [{ filename: 'photo.png', mimeType: 'image/png' }],
            })

            const result = vendor.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('REF:_event_media_')
        })

        test('should generate _event_media_ for video attachments', () => {
            const message = createMockGmailMessage({
                text: 'Check this video',
                attachments: [{ filename: 'video.mp4', mimeType: 'video/mp4' }],
            })

            const result = vendor.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('REF:_event_media_')
        })

        test('should generate _event_voice_note_ for audio attachments', () => {
            const message = createMockGmailMessage({
                text: '',
                attachments: [{ filename: 'voice.mp3', mimeType: 'audio/mp3' }],
            })

            const result = vendor.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('REF:_event_voice_note_')
        })

        test('should generate _event_document_ for application/pdf', () => {
            const message = createMockGmailMessage({
                text: '',
                attachments: [{ filename: 'document.pdf', mimeType: 'application/pdf' }],
            })

            const result = vendor.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('REF:_event_document_')
        })

        test('should generate _event_document_ for text/csv', () => {
            const message = createMockGmailMessage({
                text: '',
                attachments: [{ filename: 'data.csv', mimeType: 'text/csv' }],
            })

            const result = vendor.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('REF:_event_document_')
        })

        test('should NOT generate _event_document_ for text/plain attachments', () => {
            const message = createMockGmailMessage({
                text: '',
                attachments: [{ filename: 'note.txt', mimeType: 'text/plain' }],
            })

            const result = vendor.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('')
        })

        test('should NOT generate _event_document_ for text/html attachments', () => {
            const message = createMockGmailMessage({
                text: '',
                attachments: [{ filename: 'page.html', mimeType: 'text/html' }],
            })

            const result = vendor.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('')
        })

        test('should keep text body when no special attachments', () => {
            const message = createMockGmailMessage({
                text: 'Hello world',
                attachments: [],
            })

            const result = vendor.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('Hello world')
        })
    })

    describe('parseMessageToContext - event priority', () => {
        test('MEDIA should have priority over VOICE_NOTE', () => {
            const message = createMockGmailMessage({
                text: '',
                attachments: [
                    { filename: 'photo.jpg', mimeType: 'image/jpeg' },
                    { filename: 'audio.mp3', mimeType: 'audio/mp3' },
                ],
            })

            const result = vendor.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('REF:_event_media_')
        })

        test('MEDIA should have priority over DOCUMENT', () => {
            const message = createMockGmailMessage({
                text: '',
                attachments: [
                    { filename: 'video.mp4', mimeType: 'video/mp4' },
                    { filename: 'doc.pdf', mimeType: 'application/pdf' },
                ],
            })

            const result = vendor.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('REF:_event_media_')
        })

        test('VOICE_NOTE should have priority over DOCUMENT', () => {
            const message = createMockGmailMessage({
                text: '',
                attachments: [
                    { filename: 'voice.ogg', mimeType: 'audio/ogg' },
                    { filename: 'doc.doc', mimeType: 'application/msword' },
                ],
            })

            const result = vendor.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('REF:_event_voice_note_')
        })

        test('DOCUMENT only triggers when no text body', () => {
            const message = createMockGmailMessage({
                text: 'Please see attached document',
                attachments: [{ filename: 'report.pdf', mimeType: 'application/pdf' }],
            })

            const result = vendor.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('Please see attached document')
        })

        test('MEDIA triggers even with text body', () => {
            const message = createMockGmailMessage({
                text: 'Check out this photo!',
                attachments: [{ filename: 'photo.png', mimeType: 'image/png' }],
            })

            const result = vendor.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('REF:_event_media_')
        })

        test('VOICE_NOTE triggers even with text body', () => {
            const message = createMockGmailMessage({
                text: 'Listen to this',
                attachments: [{ filename: 'recording.wav', mimeType: 'audio/wav' }],
            })

            const result = vendor.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('REF:_event_voice_note_')
        })
    })

    describe('parseMessageToContext - email parsing', () => {
        test('should return null for email without From header', () => {
            const message: gmail_v1.Schema$Message = {
                id: 'gmail-id',
                threadId: 'thread-id',
                payload: {
                    headers: [
                        { name: 'To', value: 'recipient@example.com' },
                        { name: 'Subject', value: 'Test' },
                    ],
                    mimeType: 'text/plain',
                    body: { data: Buffer.from('Hello').toString('base64url') },
                },
            }

            const result = vendor.parseMessageToContext(message, 'gmail-id')

            expect(result).toBeNull()
        })

        test('should detect reply from In-Reply-To header', () => {
            const message = createMockGmailMessage({
                text: 'Thanks for your email',
                inReplyTo: '<original@gmail.com>',
            })

            const result = vendor.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.isReply).toBe(true)
            expect(result.inReplyTo).toBe('<original@gmail.com>')
        })

        test('should detect reply from References header', () => {
            const message = createMockGmailMessage({
                text: 'Following up',
                references: '<msg1@gmail.com> <msg2@gmail.com>',
            })

            const result = vendor.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.isReply).toBe(true)
        })

        test('should include threadId from Gmail API', () => {
            const message = createMockGmailMessage({
                text: 'Reply',
                threadId: 'gmail-thread-123',
            })

            const result = vendor.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.threadId).toBe('gmail-thread-123')
        })

        test('should include attachments in context', () => {
            const message = createMockGmailMessage({
                text: 'See attached',
                attachments: [{ filename: 'notes.txt', mimeType: 'text/plain', size: 500 }],
            })

            const result = vendor.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.attachments).toBeDefined()
            expect(result.attachments).toHaveLength(1)
            expect(result.attachments![0].filename).toBe('notes.txt')
            expect(result.attachments![0].contentType).toBe('text/plain')
        })

        test('should use default subject when missing', () => {
            const message: gmail_v1.Schema$Message = {
                id: 'gmail-id',
                threadId: 'thread-id',
                payload: {
                    headers: [
                        { name: 'From', value: 'sender@example.com' },
                        { name: 'Date', value: new Date().toISOString() },
                    ],
                    mimeType: 'text/plain',
                    body: { data: Buffer.from('Hello').toString('base64url') },
                },
            }

            const result = vendor.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.subject).toBe('(no subject)')
        })

        test('should include gmailId in context', () => {
            const message = createMockGmailMessage({ text: 'Hello' })

            const result = vendor.parseMessageToContext(message, 'my-gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.gmailId).toBe('my-gmail-id')
        })
    })

    describe('parseMessageToContext - messageSource option', () => {
        test('should use body by default', () => {
            const vendorDefault = new GmailCoreVendor(mockConfig)
            const message = createMockGmailMessage({
                text: 'This is the body',
                subject: 'This is the subject',
            })

            const result = vendorDefault.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('This is the body')
        })

        test('should use subject when messageSource is "subject"', () => {
            const vendorSubject = new GmailCoreVendor({
                ...mockConfig,
                messageSource: 'subject',
            })
            const message = createMockGmailMessage({
                text: 'This is the body',
                subject: 'This is the subject',
            })

            const result = vendorSubject.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('This is the subject')
        })

        test('should use both when messageSource is "both"', () => {
            const vendorBoth = new GmailCoreVendor({
                ...mockConfig,
                messageSource: 'both',
            })
            const message = createMockGmailMessage({
                text: 'This is the body',
                subject: 'This is the subject',
            })

            const result = vendorBoth.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('This is the subject\n\nThis is the body')
        })

        test('should handle empty body with messageSource "both"', () => {
            const vendorBoth = new GmailCoreVendor({
                ...mockConfig,
                messageSource: 'both',
            })
            const message = createMockGmailMessage({
                text: '',
                subject: 'Only subject',
            })

            const result = vendorBoth.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('Only subject')
        })

        test('messageSource should not affect MEDIA event detection', () => {
            const vendorSubject = new GmailCoreVendor({
                ...mockConfig,
                messageSource: 'subject',
            })
            const message = createMockGmailMessage({
                text: 'Check this image',
                subject: 'Photo for you',
                attachments: [{ filename: 'photo.png', mimeType: 'image/png' }],
            })

            const result = vendorSubject.parseMessageToContext(message, 'gmail-id') as GmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('REF:_event_media_')
        })
    })

    describe('parseEmailHeader', () => {
        test('should parse "Name <email>" format', () => {
            const result = vendor.parseEmailHeader('John Doe <john@example.com>')
            expect(result.name).toBe('John Doe')
            expect(result.address).toBe('john@example.com')
        })

        test('should parse quoted name format', () => {
            const result = vendor.parseEmailHeader('"John Doe" <john@example.com>')
            expect(result.name).toBe('John Doe')
            expect(result.address).toBe('john@example.com')
        })

        test('should parse plain email address', () => {
            const result = vendor.parseEmailHeader('john@example.com')
            expect(result.name).toBe('')
            expect(result.address).toBe('john@example.com')
        })
    })
})
