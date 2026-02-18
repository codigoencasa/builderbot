import { describe, expect, test, jest, beforeEach } from '@jest/globals'
import type { ParsedMail, AddressObject } from 'mailparser'

// Mock @builderbot/bot before importing EmailCoreVendor
jest.mock('@builderbot/bot', () => ({
    ProviderClass: class MockProviderClass {},
    utils: {
        generateRefProvider: jest.fn((event: string) => `REF:${event}`),
    },
}))

import { EmailCoreVendor } from '../src/email/core'
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

/**
 * Helper to create a mock ParsedMail object
 */
const createMockParsedMail = (options: {
    text?: string
    html?: string
    attachments?: Array<{
        filename?: string
        contentType: string
        size?: number
        content?: Buffer
    }>
    from?: string
    subject?: string
    messageId?: string
    inReplyTo?: string
    references?: string[]
}): ParsedMail => {
    const fromAddress = options.from || 'sender@example.com'
    return {
        from: {
            value: [{ address: fromAddress, name: 'Test Sender' }],
            html: '',
            text: fromAddress,
        } as AddressObject,
        to: {
            value: [{ address: 'recipient@example.com', name: 'Recipient' }],
            html: '',
            text: 'recipient@example.com',
        } as AddressObject,
        subject: options.subject !== undefined ? options.subject : 'Test Subject',
        messageId: options.messageId || '<test123@example.com>',
        text: options.text || '',
        html: options.html || false,
        textAsHtml: options.text || '',
        attachments: (options.attachments || []).map((att) => ({
            filename: att.filename || 'file',
            contentType: att.contentType,
            size: att.size || 100,
            content: att.content || Buffer.from('test'),
            contentDisposition: 'attachment',
            related: false,
            type: att.contentType.split('/')[0],
            contentId: undefined,
            cid: undefined,
            headers: new Map(),
            checksum: 'abc123',
        })),
        inReplyTo: options.inReplyTo,
        references: options.references,
        date: new Date(),
        headerLines: [],
        headers: new Map(),
    } as unknown as ParsedMail
}

describe('EmailCoreVendor', () => {
    let vendor: EmailCoreVendor

    beforeEach(() => {
        jest.clearAllMocks()
        vendor = new EmailCoreVendor(mockConfig)
    })

    describe('parseEmailToContext - event detection', () => {
        test('should generate _event_media_ for image attachments', () => {
            const parsed = createMockParsedMail({
                text: 'Hello',
                attachments: [{ contentType: 'image/png', filename: 'photo.png' }],
            })

            const result = (vendor as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('REF:_event_media_')
        })

        test('should generate _event_media_ for video attachments', () => {
            const parsed = createMockParsedMail({
                text: 'Check this video',
                attachments: [{ contentType: 'video/mp4', filename: 'video.mp4' }],
            })

            const result = (vendor as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('REF:_event_media_')
        })

        test('should generate _event_voice_note_ for audio attachments', () => {
            const parsed = createMockParsedMail({
                text: '',
                attachments: [{ contentType: 'audio/mp3', filename: 'voice.mp3' }],
            })

            const result = (vendor as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('REF:_event_voice_note_')
        })

        test('should generate _event_document_ for application/pdf', () => {
            const parsed = createMockParsedMail({
                text: '', // Empty body for document to trigger
                attachments: [{ contentType: 'application/pdf', filename: 'document.pdf' }],
            })

            const result = (vendor as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('REF:_event_document_')
        })

        test('should generate _event_document_ for text/csv', () => {
            const parsed = createMockParsedMail({
                text: '', // Empty body for document to trigger
                attachments: [{ contentType: 'text/csv', filename: 'data.csv' }],
            })

            const result = (vendor as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('REF:_event_document_')
        })

        test('should NOT generate _event_document_ for text/plain attachments', () => {
            const parsed = createMockParsedMail({
                text: '',
                attachments: [{ contentType: 'text/plain', filename: 'note.txt' }],
            })

            const result = (vendor as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            // Should keep empty body, not generate document event
            expect(result.body).toBe('')
        })

        test('should NOT generate _event_document_ for text/html attachments', () => {
            const parsed = createMockParsedMail({
                text: '',
                attachments: [{ contentType: 'text/html', filename: 'page.html' }],
            })

            const result = (vendor as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            // Should keep empty body, not generate document event
            expect(result.body).toBe('')
        })

        test('should keep text body when no special attachments', () => {
            const parsed = createMockParsedMail({
                text: 'Hello world',
                attachments: [],
            })

            const result = (vendor as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('Hello world')
        })
    })

    describe('parseEmailToContext - event priority', () => {
        test('MEDIA should have priority over VOICE_NOTE', () => {
            const parsed = createMockParsedMail({
                text: '',
                attachments: [
                    { contentType: 'image/jpeg', filename: 'photo.jpg' },
                    { contentType: 'audio/mp3', filename: 'audio.mp3' },
                ],
            })

            const result = (vendor as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('REF:_event_media_')
        })

        test('MEDIA should have priority over DOCUMENT', () => {
            const parsed = createMockParsedMail({
                text: '',
                attachments: [
                    { contentType: 'video/mp4', filename: 'video.mp4' },
                    { contentType: 'application/pdf', filename: 'doc.pdf' },
                ],
            })

            const result = (vendor as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('REF:_event_media_')
        })

        test('VOICE_NOTE should have priority over DOCUMENT', () => {
            const parsed = createMockParsedMail({
                text: '',
                attachments: [
                    { contentType: 'audio/ogg', filename: 'voice.ogg' },
                    { contentType: 'application/msword', filename: 'doc.doc' },
                ],
            })

            const result = (vendor as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('REF:_event_voice_note_')
        })

        test('DOCUMENT only triggers when no text body', () => {
            const parsed = createMockParsedMail({
                text: 'Please see attached document',
                attachments: [{ contentType: 'application/pdf', filename: 'report.pdf' }],
            })

            const result = (vendor as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            // Should keep text body since it's not empty
            expect(result.body).toBe('Please see attached document')
        })

        test('MEDIA triggers even with text body', () => {
            const parsed = createMockParsedMail({
                text: 'Check out this photo!',
                attachments: [{ contentType: 'image/png', filename: 'photo.png' }],
            })

            const result = (vendor as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            // MEDIA always triggers regardless of text
            expect(result.body).toBe('REF:_event_media_')
        })

        test('VOICE_NOTE triggers even with text body', () => {
            const parsed = createMockParsedMail({
                text: 'Listen to this',
                attachments: [{ contentType: 'audio/wav', filename: 'recording.wav' }],
            })

            const result = (vendor as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            // VOICE_NOTE always triggers regardless of text
            expect(result.body).toBe('REF:_event_voice_note_')
        })
    })

    describe('parseEmailToContext - email parsing', () => {
        test('should return null for email without from address', () => {
            const parsed = createMockParsedMail({ text: 'Hello' })
            // Remove from address
            ;(parsed as any).from = undefined

            const result = (vendor as any).parseEmailToContext(parsed, 1)

            expect(result).toBeNull()
        })

        test('should detect reply from inReplyTo header', () => {
            const parsed = createMockParsedMail({
                text: 'Thanks for your email',
                inReplyTo: '<original@example.com>',
            })

            const result = (vendor as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            expect(result.isReply).toBe(true)
            expect(result.inReplyTo).toBe('<original@example.com>')
        })

        test('should detect reply from references header', () => {
            const parsed = createMockParsedMail({
                text: 'Following up',
                references: ['<msg1@example.com>', '<msg2@example.com>'],
            })

            const result = (vendor as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            expect(result.isReply).toBe(true)
        })

        test('should extract threadId from references', () => {
            const parsed = createMockParsedMail({
                text: 'Reply',
                references: ['<thread-start@example.com>', '<msg2@example.com>'],
            })

            const result = (vendor as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            expect(result.threadId).toBe('<thread-start@example.com>')
        })

        test('should include attachments in context', () => {
            const parsed = createMockParsedMail({
                text: 'See attached',
                attachments: [{ contentType: 'text/plain', filename: 'notes.txt', size: 500 }],
            })

            const result = (vendor as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            expect(result.attachments).toBeDefined()
            expect(result.attachments).toHaveLength(1)
            expect(result.attachments![0].filename).toBe('notes.txt')
            expect(result.attachments![0].contentType).toBe('text/plain')
        })

        test('should use default subject when missing', () => {
            const parsed = createMockParsedMail({ text: 'Hello' })
            ;(parsed as any).subject = undefined

            const result = (vendor as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            expect(result.subject).toBe('(no subject)')
        })
    })

    describe('parseEmailToContext - messageSource option', () => {
        test('should use body by default', () => {
            const vendorDefault = new EmailCoreVendor(mockConfig)
            const parsed = createMockParsedMail({
                text: 'This is the body',
                subject: 'This is the subject',
            })

            const result = (vendorDefault as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('This is the body')
        })

        test('should use subject when messageSource is "subject"', () => {
            const vendorSubject = new EmailCoreVendor({
                ...mockConfig,
                messageSource: 'subject',
            })
            const parsed = createMockParsedMail({
                text: 'This is the body',
                subject: 'This is the subject',
            })

            const result = (vendorSubject as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('This is the subject')
        })

        test('should use both when messageSource is "both"', () => {
            const vendorBoth = new EmailCoreVendor({
                ...mockConfig,
                messageSource: 'both',
            })
            const parsed = createMockParsedMail({
                text: 'This is the body',
                subject: 'This is the subject',
            })

            const result = (vendorBoth as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('This is the subject\n\nThis is the body')
        })

        test('should handle empty body with messageSource "both"', () => {
            const vendorBoth = new EmailCoreVendor({
                ...mockConfig,
                messageSource: 'both',
            })
            const parsed = createMockParsedMail({
                text: '',
                subject: 'Only subject',
            })

            const result = (vendorBoth as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            expect(result.body).toBe('Only subject')
        })

        test('should handle empty subject with messageSource "both"', () => {
            const vendorBoth = new EmailCoreVendor({
                ...mockConfig,
                messageSource: 'both',
            })
            const parsed = createMockParsedMail({
                text: 'Only body',
                subject: '',
            })

            const result = (vendorBoth as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            // Note: subject in context will be '(no subject)' but body uses the raw value
            expect(result.body).toBe('Only body')
        })

        test('messageSource should not affect MEDIA event detection', () => {
            const vendorSubject = new EmailCoreVendor({
                ...mockConfig,
                messageSource: 'subject',
            })
            const parsed = createMockParsedMail({
                text: 'Check this image',
                subject: 'Photo for you',
                attachments: [{ contentType: 'image/png', filename: 'photo.png' }],
            })

            const result = (vendorSubject as any).parseEmailToContext(parsed, 1) as EmailBotContext

            expect(result).not.toBeNull()
            // MEDIA event should override messageSource
            expect(result.body).toBe('REF:_event_media_')
        })
    })
})
