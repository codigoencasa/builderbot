import type { SendOptions, BotContext } from '@builderbot/bot/dist/types'

import type { EmailBotContext, EmailSendOptions } from '../types'

/**
 * Interface for the Email Provider
 */
export interface EmailInterface {
    /**
     * Send an email with optional media attachment
     * @param to - Recipient email address
     * @param message - Email body content
     * @param mediaPath - Path to media file to attach
     * @param options - Additional email options
     */
    sendMedia: (to: string, message: string, mediaPath: string, options?: EmailSendOptions) => Promise<any>

    /**
     * Send an email message
     * @param to - Recipient email address
     * @param message - Email body content
     * @param options - Send options including subject, attachments, etc.
     */
    sendMessage: (to: string, message: string, options?: SendOptions & EmailSendOptions) => Promise<any>

    /**
     * Save an attachment from an email to disk
     * @param ctx - Email context with attachments
     * @param options - Save options (path, attachment index)
     */
    saveFile: (
        ctx: Partial<EmailBotContext & BotContext>,
        options?: { path?: string; attachmentIndex?: number }
    ) => Promise<string>

    /**
     * Reply to an existing email thread
     * @param ctx - Original email context
     * @param message - Reply message content
     * @param options - Additional email options
     */
    reply: (
        ctx: EmailBotContext,
        message: string,
        options?: Omit<EmailSendOptions, 'inReplyTo' | 'references'>
    ) => Promise<any>

    /**
     * Get all attachments from an email
     * @param ctx - Email context
     */
    getAttachments: (ctx: EmailBotContext) => EmailBotContext['attachments']

    /**
     * Check if the email is a reply to another email
     * @param ctx - Email context
     */
    isReply: (ctx: EmailBotContext) => boolean

    /**
     * Get the thread ID from an email
     * @param ctx - Email context
     */
    getThreadId: (ctx: EmailBotContext) => string | undefined

    /**
     * Disconnect the email provider
     */
    disconnect: () => Promise<void>
}
