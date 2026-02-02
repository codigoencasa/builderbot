import { ProviderClass } from '@builderbot/bot'
import type { BotContext, SendOptions } from '@builderbot/bot/dist/types'
import { writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

import { GmailCoreVendor } from './core'
import type { IGmailProviderArgs, GmailBotContext, GmailSendOptions } from '../types'

/**
 * Gmail Provider for BuilderBot
 * Uses Gmail API with OAuth2 for sending and receiving emails
 * @extends ProviderClass
 */
class GmailProvider extends ProviderClass<GmailCoreVendor> {
    globalVendorArgs: IGmailProviderArgs

    // Map to store the last context of each conversation for thread replies
    private conversationContexts: Map<string, GmailBotContext> = new Map()

    constructor(args: IGmailProviderArgs) {
        super()

        // Validate required configuration
        if (!args.email) {
            throw new Error('Gmail email address is required')
        }
        if (!args.oauth2) {
            throw new Error('OAuth2 configuration is required')
        }
        if (!args.oauth2.clientId || !args.oauth2.clientSecret || !args.oauth2.refreshToken) {
            throw new Error('OAuth2 clientId, clientSecret, and refreshToken are required')
        }

        this.globalVendorArgs = {
            name: 'gmail-bot',
            port: 3000,
            writeMyself: 'none',
            label: 'INBOX',
            markAsRead: true,
            messageSource: 'body',
            pollingInterval: 10000,
            ...args,
        }
    }

    /**
     * Initialize the Gmail vendor (API connection)
     */
    protected async initVendor(): Promise<GmailCoreVendor> {
        console.log('[GmailProvider] initVendor() called')
        const vendor = new GmailCoreVendor(this.globalVendorArgs)
        this.vendor = vendor

        // Connect to Gmail API
        await vendor.connect()

        console.log('[GmailProvider] initVendor() returning vendor')
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
        res.end('Gmail Provider running')
    }

    /**
     * Webhook handler for Gmail push notifications (optional)
     */
    private webhookHandler = (req: any, res: any) => {
        const body = req.body
        console.log('[GmailProvider] Webhook received:', body)
        res.end(JSON.stringify({ status: 'ok' }))
    }

    /**
     * Map vendor events to provider events
     */
    protected busEvents = () => {
        console.log('[GmailProvider] busEvents() called - registering listeners')
        return [
            {
                event: 'auth_failure',
                func: (payload: any) => this.emit('auth_failure', payload),
            },
            {
                event: 'ready',
                func: () => {
                    console.log('[GmailProvider] busEvents ready handler called')
                    this.emit('ready', true)
                },
            },
            {
                event: 'message',
                func: (payload: GmailBotContext) => {
                    console.log('[GmailProvider] busEvents message handler called!')
                    console.log('[GmailProvider] Payload from:', payload.from, 'body:', payload.body?.substring(0, 50))
                    // Store context to enable thread replies
                    this.conversationContexts.set(payload.from, payload)
                    this.emit('message', payload)
                    console.log('[GmailProvider] Provider emitted message to bot')
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
                    console.error('[GmailProvider] Error:', payload)
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
    async sendMessage(to: string, message: string, options?: SendOptions & GmailSendOptions): Promise<any> {
        // Look up existing conversation context for thread replies
        const conversationCtx = this.conversationContexts.get(to)

        // Build email options with thread context if available
        const baseSubject =
            options?.subject || (conversationCtx?.subject ? conversationCtx.subject : 'Message from Bot')
        const subject =
            conversationCtx && !baseSubject.toLowerCase().startsWith('re:') ? `Re: ${baseSubject}` : baseSubject

        const emailOptions: GmailSendOptions = {
            ...options,
            subject,
            inReplyTo: options?.inReplyTo || conversationCtx?.messageId,
            references:
                options?.references ||
                (conversationCtx
                    ? ([conversationCtx.threadId || conversationCtx.messageId].filter(Boolean) as string[])
                    : undefined),
            threadId: options?.threadId || conversationCtx?.threadId,
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
    async sendMedia(to: string, message: string, mediaPath: string, options?: GmailSendOptions): Promise<any> {
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
        ctx: GmailBotContext,
        message: string,
        options?: Omit<GmailSendOptions, 'inReplyTo' | 'references' | 'threadId'>
    ): Promise<any> {
        return this.vendor.replyToEmail(ctx, message, options)
    }

    /**
     * Save an attachment from an email to disk
     * @param ctx - Email context containing attachments
     * @param options - Save options (path, attachment index)
     */
    async saveFile(
        ctx: Partial<GmailBotContext & BotContext>,
        options?: { path?: string; attachmentIndex?: number }
    ): Promise<string> {
        try {
            const gmailCtx = ctx as GmailBotContext

            if (!gmailCtx.attachments || gmailCtx.attachments.length === 0) {
                throw new Error('No attachments in email')
            }

            const attachmentIndex = options?.attachmentIndex ?? 0
            const attachment = gmailCtx.attachments[attachmentIndex]

            if (!attachment) {
                throw new Error(`Attachment at index ${attachmentIndex} not found`)
            }

            // Download attachment content from Gmail API if needed
            let content = attachment.content
            if (!content && attachment.attachmentId && gmailCtx.gmailId) {
                content = (await this.vendor.downloadAttachment(gmailCtx.gmailId, attachment.attachmentId)) || undefined
            }

            if (!content) {
                throw new Error('Attachment content not available')
            }

            const savePath = options?.path ?? tmpdir()
            const fileName = `${Date.now()}-${attachment.filename}`
            const filePath = join(savePath, fileName)

            await writeFile(filePath, content)
            return resolve(filePath)
        } catch (error) {
            console.error('[GmailProvider] Error saving file:', error)
            throw error
        }
    }

    /**
     * Get all attachments from an email
     * @param ctx - Email context
     */
    getAttachments(ctx: GmailBotContext) {
        return ctx.attachments || []
    }

    /**
     * Check if the email is a reply
     * @param ctx - Email context
     */
    isReply(ctx: GmailBotContext): boolean {
        return ctx.isReply
    }

    /**
     * Get the thread ID from an email
     * @param ctx - Email context
     */
    getThreadId(ctx: GmailBotContext): string | undefined {
        return ctx.threadId
    }

    /**
     * Disconnect the Gmail provider
     */
    async disconnect(): Promise<void> {
        if (this.vendor) {
            await this.vendor.disconnect()
        }
    }
}

export { GmailProvider }
