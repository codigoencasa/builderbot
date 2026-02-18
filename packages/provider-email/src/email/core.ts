import { utils } from '@builderbot/bot'
import { ImapFlow } from 'imapflow'
import { simpleParser, type ParsedMail, type AddressObject } from 'mailparser'
import EventEmitter from 'node:events'
import nodemailer, { type Transporter } from 'nodemailer'

import type { IEmailProviderArgs, EmailBotContext, EmailSendOptions, EmailAttachment } from '../types'

/**
 * Class representing EmailCoreVendor, handles IMAP/SMTP operations.
 * @extends EventEmitter
 */
export class EmailCoreVendor extends EventEmitter {
    private imapClient: ImapFlow | null = null
    private smtpTransporter: Transporter | null = null
    private config: IEmailProviderArgs
    private isConnected: boolean = false
    private reconnectAttempts: number = 0
    private maxReconnectAttempts: number = 10
    private reconnectDelay: number = 5000

    constructor(config: IEmailProviderArgs) {
        super()
        this.config = config
        this.initializeSmtp()
    }

    /**
     * Initialize SMTP transporter for sending emails
     */
    private initializeSmtp(): void {
        try {
            this.smtpTransporter = nodemailer.createTransport({
                host: this.config.smtp.host,
                port: this.config.smtp.port,
                secure: this.config.smtp.secure ?? true,
                auth: {
                    user: this.config.smtp.auth.user,
                    pass: this.config.smtp.auth.pass,
                },
            })
            console.log('[EmailProvider] SMTP transporter initialized')
        } catch (error) {
            console.error('[EmailProvider] Failed to initialize SMTP:', error)
            this.emit('auth_failure', error)
        }
    }

    /**
     * Connect to IMAP server and start listening for new emails
     */
    public async connect(): Promise<void> {
        try {
            this.imapClient = new ImapFlow({
                host: this.config.imap.host,
                port: this.config.imap.port,
                secure: this.config.imap.secure ?? true,
                auth: {
                    user: this.config.imap.auth.user,
                    pass: this.config.imap.auth.pass,
                },
                logger: false,
            })

            // Handle connection events
            this.imapClient.on('error', (err: Error) => {
                console.error('[EmailProvider] IMAP error:', err)
                this.emit('error', err)
                this.handleDisconnect()
            })

            this.imapClient.on('close', () => {
                console.log('[EmailProvider] IMAP connection closed')
                this.isConnected = false
                this.handleDisconnect()
            })

            await this.imapClient.connect()
            this.isConnected = true
            this.reconnectAttempts = 0
            console.log('[EmailProvider] Connected to IMAP server')

            const host = {
                email: this.config.imap.auth.user,
                phone: this.config.imap.auth.user,
            }
            this.emit('host', host)
            this.emit('ready')

            // Start listening for new emails (non-blocking)
            this.startIdleListener()
        } catch (error) {
            console.error('[EmailProvider] Failed to connect to IMAP:', error)
            this.emit('auth_failure', error)
            throw error
        }
    }

    /**
     * Handle disconnection and attempt reconnection
     */
    private async handleDisconnect(): Promise<void> {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[EmailProvider] Max reconnection attempts reached')
            this.emit('auth_failure', new Error('Max reconnection attempts reached'))
            return
        }

        this.reconnectAttempts++
        const delay = this.reconnectDelay * this.reconnectAttempts

        console.log(
            `[EmailProvider] Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
        )

        setTimeout(async () => {
            try {
                await this.connect()
            } catch (error) {
                console.error('[EmailProvider] Reconnection failed:', error)
            }
        }, delay)
    }

    /**
     * Start IMAP IDLE listener for real-time email notifications
     * This runs in the background and doesn't block the initialization
     */
    private startIdleListener(): void {
        if (!this.imapClient || !this.isConnected) return

        const mailbox = this.config.mailbox || 'INBOX'

        // Listen for new messages using EXISTS event
        this.imapClient.on('exists', async (data: { path: string; count: number; prevCount: number }) => {
            if (data.count > data.prevCount) {
                console.log(`[EmailProvider] New email detected in ${data.path}`)
                await this.fetchNewEmails(data.prevCount + 1, data.count)
            }
        })

        // Start the IDLE loop in background
        this.runIdleLoop(mailbox)
    }

    /**
     * Run the IDLE loop in background without blocking
     */
    private async runIdleLoop(mailbox: string): Promise<void> {
        try {
            const lock = await this.imapClient!.getMailboxLock(mailbox)

            try {
                console.log(`[EmailProvider] Starting IDLE mode on ${mailbox}`)

                // Keep the connection alive with IDLE
                while (this.isConnected && this.imapClient) {
                    try {
                        await this.imapClient.idle()
                    } catch (idleError) {
                        if (this.isConnected) {
                            console.error('[EmailProvider] IDLE error:', idleError)
                        }
                        break
                    }
                }
            } finally {
                lock.release()
            }
        } catch (error) {
            console.error('[EmailProvider] Failed to start IDLE listener:', error)
            this.emit('error', error)
        }
    }

    /**
     * Fetch new emails from a sequence range
     */
    private async fetchNewEmails(startSeq: number, endSeq: number): Promise<void> {
        if (!this.imapClient || !this.isConnected) return

        const mailbox = this.config.mailbox || 'INBOX'
        const processedEmails: { uid: number; context: EmailBotContext }[] = []

        try {
            const lock = await this.imapClient.getMailboxLock(mailbox)

            try {
                for await (const message of this.imapClient.fetch(`${startSeq}:${endSeq}`, {
                    source: true,
                    uid: true,
                })) {
                    try {
                        const parsed = await simpleParser(message.source)
                        const emailContext = this.parseEmailToContext(parsed, message.uid)

                        if (emailContext) {
                            processedEmails.push({ uid: message.uid, context: emailContext })
                        }
                    } catch (parseError) {
                        console.error('[EmailProvider] Failed to parse email:', parseError)
                    }
                }

                // Mark emails as read after fetching (outside the fetch iterator)
                if (this.config.markAsRead !== false && processedEmails.length > 0) {
                    const uids = processedEmails.map((e) => e.uid)
                    try {
                        await this.imapClient.messageFlagsAdd(uids, ['\\Seen'])
                    } catch (flagError) {
                        console.error('[EmailProvider] Failed to mark emails as read:', flagError)
                    }
                }
            } finally {
                lock.release()
            }

            // Emit events after releasing the lock to avoid blocking
            for (const { context } of processedEmails) {
                console.log('[EmailProvider] About to emit message event')
                console.log('[EmailProvider] Listener count for "message":', this.listenerCount('message'))
                console.log('[EmailProvider] Listeners:', this.listeners('message').length)
                this.emit('message', context)
                console.log('[EmailProvider] Message event emitted')
            }
        } catch (error) {
            console.error('[EmailProvider] Failed to fetch new emails:', error)
        }
    }

    /**
     * Parse a mailparser ParsedMail object to EmailBotContext
     */
    private parseEmailToContext(parsed: ParsedMail, uid: number): EmailBotContext | null {
        const fromAddress = this.extractAddress(parsed.from)
        if (!fromAddress) {
            console.warn('[EmailProvider] Email has no from address, skipping')
            return null
        }

        // Extract attachments
        const attachments: EmailAttachment[] = (parsed.attachments || []).map((att) => ({
            filename: att.filename || 'unnamed',
            contentType: att.contentType,
            size: att.size,
            contentId: att.contentId,
            content: att.content,
        }))

        // Determine if this is a reply
        const isReply = !!(parsed.inReplyTo || (parsed.references && parsed.references.length > 0))

        // Get thread ID from references
        const threadId = parsed.references
            ? Array.isArray(parsed.references)
                ? parsed.references[0]
                : parsed.references
            : parsed.inReplyTo || parsed.messageId

        // Determine attachment types for event routing
        const hasMedia = attachments.some(
            (a) => a.contentType.startsWith('image/') || a.contentType.startsWith('video/')
        )
        const hasAudio = attachments.some((a) => a.contentType.startsWith('audio/'))
        const hasDocument = attachments.some((a) => {
            // application/* are documents (pdf, msword, etc.)
            if (a.contentType.startsWith('application/')) return true
            // text/csv, text/calendar, etc. are documents, but NOT text/plain or text/html
            if (
                a.contentType.startsWith('text/') &&
                !a.contentType.includes('plain') &&
                !a.contentType.includes('html')
            ) {
                return true
            }
            return false
        })

        // Determine base body based on messageSource config
        let body = ''
        const messageSource = this.config.messageSource || 'body'
        switch (messageSource) {
            case 'subject':
                body = parsed.subject || ''
                break
            case 'both':
                body = [parsed.subject, parsed.text].filter(Boolean).join('\n\n')
                break
            case 'body':
            default:
                body = parsed.text || ''
                break
        }

        // Build body - generate special events for attachments
        // Priority: MEDIA > VOICE_NOTE > DOCUMENT > text
        if (hasMedia) {
            // Media attachments always trigger MEDIA event
            body = utils.generateRefProvider('_event_media_')
        } else if (hasAudio) {
            // Audio attachments trigger VOICE_NOTE event
            body = utils.generateRefProvider('_event_voice_note_')
        } else if (hasDocument && !body.trim()) {
            // Documents only trigger event if no text body
            body = utils.generateRefProvider('_event_document_')
        }

        const context: EmailBotContext = {
            from: fromAddress.address,
            name: fromAddress.name || fromAddress.address,
            body: body,
            subject: parsed.subject || '(no subject)',
            messageId: parsed.messageId || `${uid}@${this.config.imap.host}`,
            threadId: threadId,
            inReplyTo: parsed.inReplyTo,
            attachments: attachments.length > 0 ? attachments : undefined,
            isReply: isReply,
            html: parsed.html || undefined,
            to: this.extractAddresses(parsed.to),
            cc: parsed.cc ? this.extractAddresses(parsed.cc) : undefined,
            date: parsed.date,
            uid: uid,
        }

        return context
    }

    /**
     * Extract single address from AddressObject
     */
    private extractAddress(
        addressObj: AddressObject | AddressObject[] | undefined
    ): { address: string; name: string } | null {
        if (!addressObj) return null

        const obj = Array.isArray(addressObj) ? addressObj[0] : addressObj
        if (!obj || !obj.value || obj.value.length === 0) return null

        const first = obj.value[0]
        return {
            address: first.address || '',
            name: first.name || '',
        }
    }

    /**
     * Extract array of addresses from AddressObject
     */
    private extractAddresses(addressObj: AddressObject | AddressObject[] | undefined): string[] {
        if (!addressObj) return []

        const objects = Array.isArray(addressObj) ? addressObj : [addressObj]
        const addresses: string[] = []

        for (const obj of objects) {
            if (obj && obj.value) {
                for (const addr of obj.value) {
                    if (addr.address) {
                        addresses.push(addr.address)
                    }
                }
            }
        }

        return addresses
    }

    /**
     * Send an email via SMTP
     */
    public async sendEmail(
        to: string,
        subject: string,
        text: string,
        options?: EmailSendOptions
    ): Promise<{ messageId: string }> {
        if (!this.smtpTransporter) {
            throw new Error('SMTP transporter not initialized')
        }

        const fromEmail = this.config.fromEmail || this.config.smtp.auth.user
        const fromName = this.config.fromName || fromEmail

        const mailOptions: nodemailer.SendMailOptions = {
            from: `"${fromName}" <${fromEmail}>`,
            to: to,
            subject: subject,
            text: text,
        }

        // Add optional fields
        if (options?.html) {
            mailOptions.html = options.html
        }
        if (options?.cc) {
            mailOptions.cc = options.cc
        }
        if (options?.bcc) {
            mailOptions.bcc = options.bcc
        }
        if (options?.replyTo) {
            mailOptions.replyTo = options.replyTo
        }
        if (options?.inReplyTo) {
            mailOptions.inReplyTo = options.inReplyTo
        }
        if (options?.references) {
            mailOptions.references = Array.isArray(options.references)
                ? options.references.join(' ')
                : options.references
        }
        if (options?.attachments) {
            mailOptions.attachments = options.attachments.map((att) => ({
                filename: att.filename,
                path: att.path,
                content: att.content,
                contentType: att.contentType,
            }))
        }

        try {
            const info = await this.smtpTransporter.sendMail(mailOptions)
            console.log(`[EmailProvider] Email sent: ${info.messageId}`)
            return { messageId: info.messageId }
        } catch (error) {
            console.error('[EmailProvider] Failed to send email:', error)
            throw error
        }
    }

    /**
     * Reply to an existing email thread
     */
    public async replyToEmail(
        originalContext: EmailBotContext,
        text: string,
        options?: Omit<EmailSendOptions, 'inReplyTo' | 'references'>
    ): Promise<{ messageId: string }> {
        // Build references chain
        const references: string[] = []
        if (originalContext.threadId) {
            references.push(originalContext.threadId)
        }
        if (originalContext.messageId && originalContext.messageId !== originalContext.threadId) {
            references.push(originalContext.messageId)
        }

        // Prepare subject with Re: prefix if not already present
        let subject = originalContext.subject
        if (!subject.toLowerCase().startsWith('re:')) {
            subject = `Re: ${subject}`
        }

        return this.sendEmail(originalContext.from, subject, text, {
            ...options,
            inReplyTo: originalContext.messageId,
            references: references,
        })
    }

    /**
     * Download attachment content
     */
    public async downloadAttachment(ctx: EmailBotContext, attachmentIndex: number): Promise<Buffer | null> {
        if (!ctx.attachments || attachmentIndex >= ctx.attachments.length) {
            return null
        }

        const attachment = ctx.attachments[attachmentIndex]
        if (attachment.content) {
            return attachment.content
        }

        // Attachment content should already be in memory from parsing
        console.warn('[EmailProvider] Attachment content not available')
        return null
    }

    /**
     * Disconnect from IMAP server
     */
    public async disconnect(): Promise<void> {
        this.isConnected = false

        if (this.imapClient) {
            try {
                await this.imapClient.logout()
            } catch (error) {
                console.error('[EmailProvider] Error during logout:', error)
            }
            this.imapClient = null
        }

        if (this.smtpTransporter) {
            this.smtpTransporter.close()
            this.smtpTransporter = null
        }

        console.log('[EmailProvider] Disconnected')
    }

    /**
     * Check if connected to IMAP server
     */
    public isImapConnected(): boolean {
        return this.isConnected && this.imapClient !== null
    }

    /**
     * Verify SMTP connection
     */
    public async verifySmtp(): Promise<boolean> {
        if (!this.smtpTransporter) return false

        try {
            await this.smtpTransporter.verify()
            return true
        } catch {
            return false
        }
    }
}
