import type { BotContext, GlobalVendorArgs } from '@builderbot/bot/dist/types'

/**
 * IMAP server configuration
 */
export interface ImapConfig {
    /** IMAP server host (e.g., 'imap.gmail.com') */
    host: string
    /** IMAP server port (e.g., 993 for SSL) */
    port: number
    /** Use secure connection (SSL/TLS) */
    secure?: boolean
    /** Authentication credentials */
    auth: {
        user: string
        pass: string
    }
}

/**
 * Source for the message body
 * - 'body': Use email body only (default)
 * - 'subject': Use email subject only
 * - 'both': Use both subject and body (format: "subject\n\nbody")
 */
export type MessageSource = 'body' | 'subject' | 'both'

/**
 * SMTP server configuration
 */
export interface SmtpConfig {
    /** SMTP server host (e.g., 'smtp.gmail.com') */
    host: string
    /** SMTP server port (e.g., 465 for SSL, 587 for TLS) */
    port: number
    /** Use secure connection (SSL/TLS) */
    secure?: boolean
    /** Authentication credentials */
    auth: {
        user: string
        pass: string
    }
}

/**
 * Email provider configuration arguments
 */
export interface IEmailProviderArgs extends GlobalVendorArgs {
    /** IMAP server configuration for receiving emails */
    imap: ImapConfig
    /** SMTP server configuration for sending emails */
    smtp: SmtpConfig
    /** Mailbox to monitor (default: 'INBOX') */
    mailbox?: string
    /** Mark emails as read after processing (default: true) */
    markAsRead?: boolean
    /** From email address for outgoing emails (defaults to imap.auth.user) */
    fromEmail?: string
    /** From name for outgoing emails */
    fromName?: string
    /** Source for message body: 'body', 'subject', or 'both' (default: 'body') */
    messageSource?: MessageSource
}

/**
 * Email attachment information
 */
export interface EmailAttachment {
    /** Attachment filename */
    filename: string
    /** MIME content type */
    contentType: string
    /** File size in bytes */
    size: number
    /** Content ID for inline attachments */
    contentId?: string
    /** Raw content buffer (available when downloading) */
    content?: Buffer
}

/**
 * Email context extending BotContext
 */
export interface EmailBotContext extends BotContext {
    /** Sender's email address */
    from: string
    /** Sender's display name */
    name: string
    /** Email body content (plain text preferred, fallback to HTML) */
    body: string
    /** Email subject line */
    subject: string
    /** Unique Message-ID header */
    messageId: string
    /** Thread ID (derived from References header) */
    threadId?: string
    /** In-Reply-To header value (if this is a reply) */
    inReplyTo?: string
    /** List of attachments in the email */
    attachments?: EmailAttachment[]
    /** Whether this email is a reply to another email */
    isReply: boolean
    /** Original HTML content */
    html?: string
    /** All recipients (To field) */
    to?: string[]
    /** CC recipients */
    cc?: string[]
    /** Email date */
    date?: Date
    /** Raw email UID from IMAP */
    uid?: number
}

/**
 * Options for sending emails
 */
export interface EmailSendOptions {
    /** Email subject (required for new threads) */
    subject?: string
    /** CC recipients */
    cc?: string | string[]
    /** BCC recipients */
    bcc?: string | string[]
    /** Reply-To address */
    replyTo?: string
    /** Attachments to send */
    attachments?: Array<{
        filename: string
        path?: string
        content?: Buffer | string
        contentType?: string
    }>
    /** HTML content (alternative to plain text) */
    html?: string
    /** In-Reply-To header for replies */
    inReplyTo?: string
    /** References header for thread continuity */
    references?: string | string[]
}

/**
 * Internal email message structure from IMAP
 */
export interface ParsedEmail {
    uid: number
    messageId: string
    from: {
        address: string
        name: string
    }
    to: Array<{
        address: string
        name: string
    }>
    cc?: Array<{
        address: string
        name: string
    }>
    subject: string
    text?: string
    html?: string
    date: Date
    inReplyTo?: string
    references?: string[]
    attachments: EmailAttachment[]
}

/**
 * Email vendor events
 */
export type EmailVendorEvents = {
    message: [payload: EmailBotContext]
    ready: []
    auth_failure: [error: Error]
    error: [error: Error]
}
