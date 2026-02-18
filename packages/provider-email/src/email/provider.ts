import { ProviderClass } from '@builderbot/bot'
import type { BotContext, SendOptions } from '@builderbot/bot/dist/types'
import { writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

import { EmailCoreVendor } from './core'
import type { IEmailProviderArgs, EmailBotContext, EmailSendOptions } from '../types'

/**
 * Email Provider for BuilderBot
 * Supports receiving emails via IMAP (with IDLE) and sending via SMTP
 * @extends ProviderClass
 */
class EmailProvider extends ProviderClass<EmailCoreVendor> {
    globalVendorArgs: IEmailProviderArgs

    // Map to store the last context of each conversation for thread replies
    private conversationContexts: Map<string, EmailBotContext> = new Map()

    constructor(args: IEmailProviderArgs) {
        super()

        // Validate required configuration
        if (!args.imap) {
            throw new Error('IMAP configuration is required')
        }
        if (!args.smtp) {
            throw new Error('SMTP configuration is required')
        }
        if (!args.imap.host || !args.imap.auth?.user || !args.imap.auth?.pass) {
            throw new Error('IMAP host and authentication are required')
        }
        if (!args.smtp.host || !args.smtp.auth?.user || !args.smtp.auth?.pass) {
            throw new Error('SMTP host and authentication are required')
        }

        this.globalVendorArgs = {
            name: 'email-bot',
            port: 3000,
            writeMyself: 'none',
            mailbox: 'INBOX',
            markAsRead: true,
            messageSource: 'body',
            ...args,
        }
    }

    /**
     * Initialize the email vendor (IMAP/SMTP connections)
     */
    protected async initVendor(): Promise<EmailCoreVendor> {
        console.log('[EmailProvider] initVendor() called')
        const vendor = new EmailCoreVendor(this.globalVendorArgs)
        this.vendor = vendor

        // Connect to IMAP server
        await vendor.connect()

        console.log('[EmailProvider] initVendor() returning vendor')
        return vendor
    }

    /**
     * Called before HTTP server initialization
     */
    protected beforeHttpServerInit(): void {
        this.server = this.server
            .use((req, _, next) => {
                req['globalVendorArgs'] = this.globalVendorArgs
                return next()
            })
            .get('/', this.indexHome)
            .post('/webhook', this.webhookHandler)
    }

    /**
     * Called after HTTP server initialization
     */
    protected afterHttpServerInit(): void {}

    /**
     * Index home endpoint
     */
    private indexHome = (_: any, res: any) => {
        res.end('Email Provider running')
    }

    /**
     * Webhook handler for external email notifications (optional)
     */
    private webhookHandler = (req: any, res: any) => {
        // This can be used for external email webhook integrations
        const body = req.body
        console.log('[EmailProvider] Webhook received:', body)
        res.end(JSON.stringify({ status: 'ok' }))
    }

    /**
     * Map vendor events to provider events
     */
    protected busEvents = () => {
        console.log('[EmailProvider] busEvents() called - registering listeners')
        return [
            {
                event: 'auth_failure',
                func: (payload: any) => this.emit('auth_failure', payload),
            },
            {
                event: 'ready',
                func: () => {
                    console.log('[EmailProvider] busEvents ready handler called')
                    this.emit('ready', true)
                },
            },
            {
                event: 'message',
                func: (payload: EmailBotContext) => {
                    console.log('[EmailProvider] busEvents message handler called!')
                    console.log('[EmailProvider] Payload from:', payload.from, 'body:', payload.body?.substring(0, 50))
                    // Store context to enable thread replies
                    this.conversationContexts.set(payload.from, payload)
                    this.emit('message', payload)
                    console.log('[EmailProvider] Provider emitted message to bot')
                },
            },
            {
                event: 'host',
                func: (payload: any) => {
                    this.emit('host', payload)
                },
            },
            {
                event: 'error',
                func: (payload: any) => {
                    console.error('[EmailProvider] Error:', payload)
                },
            },
        ]
    }

    /**
     * Send an email message
     * @param to - Recipient email address
     * @param message - Email body content
     * @param options - Send options (subject, attachments, etc.)
     */
    async sendMessage(to: string, message: string, options?: SendOptions & EmailSendOptions): Promise<any> {
        // Look up existing conversation context for thread replies
        const conversationCtx = this.conversationContexts.get(to)

        // Build email options with thread context if available
        const baseSubject =
            options?.subject || (conversationCtx?.subject ? conversationCtx.subject : 'Message from Bot')
        const subject =
            conversationCtx && !baseSubject.toLowerCase().startsWith('re:') ? `Re: ${baseSubject}` : baseSubject

        const emailOptions: EmailSendOptions = {
            ...options,
            subject,
            inReplyTo: options?.inReplyTo || conversationCtx?.messageId,
            references:
                options?.references ||
                (conversationCtx
                    ? ([conversationCtx.threadId || conversationCtx.messageId].filter(Boolean) as string[])
                    : undefined),
        }

        // Check for media/attachments
        if (options?.media) {
            return this.sendMedia(to, message, options.media, emailOptions)
        }

        return this.vendor.sendEmail(to, subject, message, emailOptions)
    }

    /**
     * Send an email with media attachment
     * @param to - Recipient email address
     * @param message - Email body content
     * @param mediaPath - Path to media file
     * @param options - Additional email options
     */
    async sendMedia(to: string, message: string, mediaPath: string, options?: EmailSendOptions): Promise<any> {
        const subject = options?.subject || 'Message with attachment'

        const attachments = [
            {
                filename: mediaPath.split('/').pop() || 'attachment',
                path: mediaPath,
            },
        ]

        return this.vendor.sendEmail(to, subject, message, {
            ...options,
            attachments: [...(options?.attachments || []), ...attachments],
        })
    }

    /**
     * Reply to an existing email thread
     * @param ctx - Original email context
     * @param message - Reply message content
     * @param options - Additional email options
     */
    async reply(
        ctx: EmailBotContext,
        message: string,
        options?: Omit<EmailSendOptions, 'inReplyTo' | 'references'>
    ): Promise<any> {
        return this.vendor.replyToEmail(ctx, message, options)
    }

    /**
     * Save an attachment from an email to disk
     * @param ctx - Email context containing attachments
     * @param options - Save options (path, attachment index)
     */
    async saveFile(
        ctx: Partial<EmailBotContext & BotContext>,
        options?: { path?: string; attachmentIndex?: number }
    ): Promise<string> {
        try {
            const emailCtx = ctx as EmailBotContext

            if (!emailCtx.attachments || emailCtx.attachments.length === 0) {
                throw new Error('No attachments in email')
            }

            const attachmentIndex = options?.attachmentIndex ?? 0
            const attachment = emailCtx.attachments[attachmentIndex]

            if (!attachment) {
                throw new Error(`Attachment at index ${attachmentIndex} not found`)
            }

            if (!attachment.content) {
                throw new Error('Attachment content not available')
            }

            const savePath = options?.path ?? tmpdir()
            const fileName = `${Date.now()}-${attachment.filename}`
            const filePath = join(savePath, fileName)

            await writeFile(filePath, attachment.content)
            return resolve(filePath)
        } catch (error) {
            console.error('[EmailProvider] Error saving file:', error)
            throw error
        }
    }

    /**
     * Get all attachments from an email
     * @param ctx - Email context
     */
    getAttachments(ctx: EmailBotContext) {
        return ctx.attachments || []
    }

    /**
     * Check if the email is a reply
     * @param ctx - Email context
     */
    isReply(ctx: EmailBotContext): boolean {
        return ctx.isReply
    }

    /**
     * Get the thread ID from an email
     * @param ctx - Email context
     */
    getThreadId(ctx: EmailBotContext): string | undefined {
        return ctx.threadId
    }

    /**
     * Disconnect the email provider
     */
    async disconnect(): Promise<void> {
        if (this.vendor) {
            await this.vendor.disconnect()
        }
    }
}

export { EmailProvider }
