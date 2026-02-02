import type { BotContext, GlobalVendorArgs } from '@builderbot/bot/dist/types'

/**
 * Gmail OAuth2 configuration
 */
export interface GmailOAuth2Config {
    /** OAuth2 Client ID from Google Cloud Console */
    clientId: string
    /** OAuth2 Client Secret from Google Cloud Console */
    clientSecret: string
    /** OAuth2 Refresh Token (obtained via authorization flow) */
    refreshToken: string
}

/**
 * Source for the message body
 * - 'body': Use email body only (default)
 * - 'subject': Use email subject only
 * - 'both': Use both subject and body (format: "subject\n\nbody")
 */
export type MessageSource = 'body' | 'subject' | 'both'

/**
 * Gmail provider configuration arguments
 */
export interface IGmailProviderArgs extends GlobalVendorArgs {
    /** Gmail account email address */
    email: string
    /** OAuth2 credentials for Gmail API */
    oauth2: GmailOAuth2Config
    /** Label to monitor for new emails (default: 'INBOX') */
    label?: string
    /** Mark emails as read after processing (default: true) */
    markAsRead?: boolean
    /** From name for outgoing emails */
    fromName?: string
    /** Source for message body: 'body', 'subject', or 'both' (default: 'body') */
    messageSource?: MessageSource
    /** Polling interval in milliseconds for checking new emails (default: 10000) */
    pollingInterval?: number
}

/**
 * Gmail attachment information
 */
export interface GmailAttachment {
    /** Attachment filename */
    filename: string
    /** MIME content type */
    contentType: string
    /** File size in bytes */
    size: number
    /** Gmail attachment ID (for downloading) */
    attachmentId?: string
    /** Raw content buffer (available after download) */
    content?: Buffer
}

/**
 * Gmail context extending BotContext
 */
export interface GmailBotContext extends BotContext {
    /** Sender's email address */
    from: string
    /** Sender's display name */
    name: string
    /** Email body content (plain text preferred, fallback to HTML) */
    body: string
    /** Email subject line */
    subject: string
    /** Gmail Message ID */
    messageId: string
    /** Gmail Thread ID */
    threadId?: string
    /** In-Reply-To header value (if this is a reply) */
    inReplyTo?: string
    /** List of attachments in the email */
    attachments?: GmailAttachment[]
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
    /** Gmail internal message ID */
    gmailId?: string
}

/**
 * Options for sending emails via Gmail
 */
export interface GmailSendOptions {
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
    /** Gmail Thread ID to reply to */
    threadId?: string
}

/**
 * Internal Gmail message structure
 */
export interface ParsedGmailMessage {
    gmailId: string
    threadId: string
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
    attachments: GmailAttachment[]
    labelIds: string[]
}

/**
 * Gmail vendor events
 */
export type GmailVendorEvents = {
    message: [payload: GmailBotContext]
    ready: []
    auth_failure: [error: Error]
    error: [error: Error]
}
