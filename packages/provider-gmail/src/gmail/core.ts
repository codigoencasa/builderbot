import { utils } from '@builderbot/bot'
import { google, type gmail_v1 } from 'googleapis'
import EventEmitter from 'node:events'

import type { IGmailProviderArgs, GmailBotContext, GmailSendOptions, GmailAttachment } from '../types'

/**
 * Class representing GmailCoreVendor, handles Gmail API operations.
 * Uses OAuth2 for authentication and Gmail API for sending/receiving.
 * @extends EventEmitter
 */
export class GmailCoreVendor extends EventEmitter {
    private gmail: gmail_v1.Gmail | null = null
    private config: IGmailProviderArgs
    private isConnected: boolean = false
    private pollingTimer: ReturnType<typeof setInterval> | null = null
    private lastHistoryId: string | null = null
    private processedMessageIds: Set<string> = new Set()

    constructor(config: IGmailProviderArgs) {
        super()
        this.config = config
    }

    /**
     * Initialize OAuth2 client and connect to Gmail API
     */
    public async connect(): Promise<void> {
        try {
            const oauth2Client = new google.auth.OAuth2(
                this.config.oauth2.clientId,
                this.config.oauth2.clientSecret
            )

            oauth2Client.setCredentials({
                refresh_token: this.config.oauth2.refreshToken,
            })

            // Force token refresh to validate credentials
            await oauth2Client.getAccessToken()

            this.gmail = google.gmail({ version: 'v1', auth: oauth2Client })
            this.isConnected = true

            console.log('[GmailProvider] Connected to Gmail API')

            // Get initial historyId to track changes
            const profile = await this.gmail.users.getProfile({ userId: 'me' })
            this.lastHistoryId = profile.data.historyId || null

            const host = {
                email: this.config.email,
                phone: this.config.email,
            }
            this.emit('host', host)
            this.emit('ready')

            // Start polling for new emails
            this.startPolling()
        } catch (error) {
            console.error('[GmailProvider] Failed to connect to Gmail API:', error)
            this.emit('auth_failure', error)
            throw error
        }
    }

    /**
     * Start polling for new emails using Gmail history API
     */
    private startPolling(): void {
        if (!this.gmail || !this.isConnected) return

        const interval = this.config.pollingInterval || 10000

        console.log(`[GmailProvider] Starting polling every ${interval}ms`)

        this.pollingTimer = setInterval(async () => {
            try {
                await this.checkForNewEmails()
            } catch (error) {
                console.error('[GmailProvider] Polling error:', error)
                this.emit('error', error)
            }
        }, interval)
    }

    /**
     * Check for new emails using Gmail history or messages.list
     */
    private async checkForNewEmails(): Promise<void> {
        if (!this.gmail || !this.isConnected) return

        try {
            if (this.lastHistoryId) {
                await this.checkHistory()
            } else {
                await this.checkLatestMessages()
            }
        } catch (error: any) {
            // If history is invalid (404), fall back to listing messages
            if (error?.code === 404 || error?.status === 404) {
                console.log('[GmailProvider] History expired, falling back to messages.list')
                this.lastHistoryId = null
                await this.checkLatestMessages()
            } else {
                throw error
            }
        }
    }

    /**
     * Check for new messages using Gmail history API
     */
    private async checkHistory(): Promise<void> {
        if (!this.gmail || !this.lastHistoryId) return

        const label = this.config.label || 'INBOX'

        const response = await this.gmail.users.history.list({
            userId: 'me',
            startHistoryId: this.lastHistoryId,
            labelId: label,
            historyTypes: ['messageAdded'],
        })

        if (response.data.historyId) {
            this.lastHistoryId = response.data.historyId
        }

        const history = response.data.history || []

        for (const record of history) {
            const messagesAdded = record.messagesAdded || []
            for (const added of messagesAdded) {
                const messageId = added.message?.id
                if (messageId && !this.processedMessageIds.has(messageId)) {
                    this.processedMessageIds.add(messageId)
                    await this.processMessage(messageId)
                }
            }
        }

        // Limit the size of processedMessageIds to prevent memory leaks
        if (this.processedMessageIds.size > 1000) {
            const entries = Array.from(this.processedMessageIds)
            this.processedMessageIds = new Set(entries.slice(-500))
        }
    }

    /**
     * Check latest messages when history is not available
     */
    private async checkLatestMessages(): Promise<void> {
        if (!this.gmail) return

        const label = this.config.label || 'INBOX'

        const response = await this.gmail.users.messages.list({
            userId: 'me',
            labelIds: [label],
            q: 'is:unread',
            maxResults: 10,
        })

        const messages = response.data.messages || []

        for (const msg of messages) {
            if (msg.id && !this.processedMessageIds.has(msg.id)) {
                this.processedMessageIds.add(msg.id)
                await this.processMessage(msg.id)
            }
        }

        // Update historyId from profile for future checks
        const profile = await this.gmail.users.getProfile({ userId: 'me' })
        if (profile.data.historyId) {
            this.lastHistoryId = profile.data.historyId
        }

        // Limit the size of processedMessageIds
        if (this.processedMessageIds.size > 1000) {
            const entries = Array.from(this.processedMessageIds)
            this.processedMessageIds = new Set(entries.slice(-500))
        }
    }

    /**
     * Process a single Gmail message by ID
     */
    private async processMessage(gmailId: string): Promise<void> {
        if (!this.gmail) return

        try {
            const response = await this.gmail.users.messages.get({
                userId: 'me',
                id: gmailId,
                format: 'full',
            })

            const message = response.data
            const context = this.parseMessageToContext(message, gmailId)

            if (context) {
                // Mark as read if configured
                if (this.config.markAsRead !== false) {
                    try {
                        await this.gmail.users.messages.modify({
                            userId: 'me',
                            id: gmailId,
                            requestBody: {
                                removeLabelIds: ['UNREAD'],
                            },
                        })
                    } catch (markError) {
                        console.error('[GmailProvider] Failed to mark email as read:', markError)
                    }
                }

                console.log('[GmailProvider] About to emit message event')
                this.emit('message', context)
                console.log('[GmailProvider] Message event emitted')
            }
        } catch (error) {
            console.error('[GmailProvider] Failed to process message:', error)
        }
    }

    /**
     * Parse a Gmail API message object to GmailBotContext
     */
    parseMessageToContext(message: gmail_v1.Schema$Message, gmailId: string): GmailBotContext | null {
        const headers = message.payload?.headers || []

        const getHeader = (name: string): string | undefined => {
            const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
            return header?.value || undefined
        }

        const fromRaw = getHeader('From')
        if (!fromRaw) {
            console.warn('[GmailProvider] Email has no From header, skipping')
            return null
        }

        const fromParsed = this.parseEmailHeader(fromRaw)

        // Extract recipients
        const toRaw = getHeader('To')
        const ccRaw = getHeader('Cc')
        const toAddresses = toRaw ? this.parseEmailListHeader(toRaw) : []
        const ccAddresses = ccRaw ? this.parseEmailListHeader(ccRaw) : undefined

        // Extract body
        const { text, html } = this.extractBody(message.payload)

        // Extract attachments info
        const attachments = this.extractAttachmentInfo(message.payload)

        // Check if reply
        const inReplyTo = getHeader('In-Reply-To')
        const referencesRaw = getHeader('References')
        const references = referencesRaw ? referencesRaw.split(/\s+/).filter(Boolean) : undefined
        const isReply = !!(inReplyTo || (references && references.length > 0))

        const subject = getHeader('Subject') || '(no subject)'
        const messageId = getHeader('Message-ID') || `${gmailId}@gmail.com`
        const dateStr = getHeader('Date')
        const date = dateStr ? new Date(dateStr) : new Date()

        // Determine attachment types for event routing
        const hasMedia = attachments.some(
            (a) => a.contentType.startsWith('image/') || a.contentType.startsWith('video/')
        )
        const hasAudio = attachments.some((a) => a.contentType.startsWith('audio/'))
        const hasDocument = attachments.some((a) => {
            if (a.contentType.startsWith('application/')) return true
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
                body = subject
                break
            case 'both':
                body = [getHeader('Subject'), text].filter(Boolean).join('\n\n')
                break
            case 'body':
            default:
                body = text || ''
                break
        }

        // Build body - generate special events for attachments
        if (hasMedia) {
            body = utils.generateRefProvider('_event_media_')
        } else if (hasAudio) {
            body = utils.generateRefProvider('_event_voice_note_')
        } else if (hasDocument && !body.trim()) {
            body = utils.generateRefProvider('_event_document_')
        }

        const context: GmailBotContext = {
            from: fromParsed.address,
            name: fromParsed.name || fromParsed.address,
            body: body,
            subject: subject,
            messageId: messageId,
            threadId: message.threadId || undefined,
            inReplyTo: inReplyTo,
            attachments: attachments.length > 0 ? attachments : undefined,
            isReply: isReply,
            html: html || undefined,
            to: toAddresses,
            cc: ccAddresses,
            date: date,
            gmailId: gmailId,
        }

        return context
    }

    /**
     * Extract body (text and html) from message payload
     */
    private extractBody(payload: gmail_v1.Schema$MessagePart | undefined): { text: string; html: string } {
        let text = ''
        let html = ''

        if (!payload) return { text, html }

        const extractFromPart = (part: gmail_v1.Schema$MessagePart): void => {
            if (part.mimeType === 'text/plain' && part.body?.data) {
                text = Buffer.from(part.body.data, 'base64url').toString('utf-8')
            } else if (part.mimeType === 'text/html' && part.body?.data) {
                html = Buffer.from(part.body.data, 'base64url').toString('utf-8')
            }

            if (part.parts) {
                for (const subPart of part.parts) {
                    extractFromPart(subPart)
                }
            }
        }

        extractFromPart(payload)

        // If no text but has HTML, do basic conversion
        if (!text && html) {
            text = html
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<\/?(div|p|br|h[1-6]|li|tr)[^>]*>/gi, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&nbsp;/gi, ' ')
                .replace(/&amp;/gi, '&')
                .replace(/&lt;/gi, '<')
                .replace(/&gt;/gi, '>')
                .replace(/&quot;/gi, '"')
                .replace(/&#39;/gi, "'")
                .replace(/\n\s*\n/g, '\n\n')
                .trim()
        }

        return { text, html }
    }

    /**
     * Extract attachment information from message payload
     */
    private extractAttachmentInfo(payload: gmail_v1.Schema$MessagePart | undefined): GmailAttachment[] {
        const attachments: GmailAttachment[] = []

        if (!payload) return attachments

        const extractFromPart = (part: gmail_v1.Schema$MessagePart): void => {
            if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
                attachments.push({
                    filename: part.filename,
                    contentType: part.mimeType || 'application/octet-stream',
                    size: part.body.size || 0,
                    attachmentId: part.body.attachmentId,
                })
            }

            if (part.parts) {
                for (const subPart of part.parts) {
                    extractFromPart(subPart)
                }
            }
        }

        extractFromPart(payload)

        return attachments
    }

    /**
     * Parse an email header like "Name <email@example.com>"
     */
    parseEmailHeader(raw: string): { address: string; name: string } {
        const match = raw.match(/^(.+?)\s*<([^>]+)>$/)
        if (match) {
            return {
                name: match[1].replace(/^["']|["']$/g, '').trim(),
                address: match[2].trim().toLowerCase(),
            }
        }
        return {
            name: '',
            address: raw.trim().toLowerCase(),
        }
    }

    /**
     * Parse a comma-separated email list header
     */
    private parseEmailListHeader(raw: string): string[] {
        // Split on commas that are not inside angle brackets
        const parts = raw.split(/,(?=(?:[^<]*<[^>]*>)*[^>]*$)/)
        return parts
            .map((part) => {
                const parsed = this.parseEmailHeader(part.trim())
                return parsed.address
            })
            .filter(Boolean)
    }

    /**
     * Send an email via Gmail API
     */
    public async sendEmail(
        to: string,
        subject: string,
        text: string,
        options?: GmailSendOptions
    ): Promise<{ messageId: string; threadId?: string }> {
        if (!this.gmail) {
            throw new Error('Gmail API client not initialized')
        }

        const fromEmail = this.config.email
        const fromName = this.config.fromName || fromEmail

        // Build raw MIME message
        const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`
        const mimeLines: string[] = []

        mimeLines.push(`From: "${fromName}" <${fromEmail}>`)
        mimeLines.push(`To: ${to}`)
        mimeLines.push(`Subject: ${subject}`)

        if (options?.cc) {
            const ccList = Array.isArray(options.cc) ? options.cc.join(', ') : options.cc
            mimeLines.push(`Cc: ${ccList}`)
        }
        if (options?.bcc) {
            const bccList = Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc
            mimeLines.push(`Bcc: ${bccList}`)
        }
        if (options?.replyTo) {
            mimeLines.push(`Reply-To: ${options.replyTo}`)
        }
        if (options?.inReplyTo) {
            mimeLines.push(`In-Reply-To: ${options.inReplyTo}`)
        }
        if (options?.references) {
            const refs = Array.isArray(options.references) ? options.references.join(' ') : options.references
            mimeLines.push(`References: ${refs}`)
        }

        const hasAttachments = options?.attachments && options.attachments.length > 0

        if (hasAttachments) {
            mimeLines.push('MIME-Version: 1.0')
            mimeLines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
            mimeLines.push('')
            mimeLines.push(`--${boundary}`)
        }

        if (options?.html) {
            if (!hasAttachments) {
                mimeLines.push('MIME-Version: 1.0')
                const altBoundary = `alt_${boundary}`
                mimeLines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`)
                mimeLines.push('')
                mimeLines.push(`--${altBoundary}`)
                mimeLines.push('Content-Type: text/plain; charset=utf-8')
                mimeLines.push('')
                mimeLines.push(text)
                mimeLines.push(`--${altBoundary}`)
                mimeLines.push('Content-Type: text/html; charset=utf-8')
                mimeLines.push('')
                mimeLines.push(options.html)
                mimeLines.push(`--${altBoundary}--`)
            } else {
                const altBoundary = `alt_${boundary}`
                mimeLines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`)
                mimeLines.push('')
                mimeLines.push(`--${altBoundary}`)
                mimeLines.push('Content-Type: text/plain; charset=utf-8')
                mimeLines.push('')
                mimeLines.push(text)
                mimeLines.push(`--${altBoundary}`)
                mimeLines.push('Content-Type: text/html; charset=utf-8')
                mimeLines.push('')
                mimeLines.push(options.html)
                mimeLines.push(`--${altBoundary}--`)
            }
        } else {
            if (hasAttachments) {
                mimeLines.push('Content-Type: text/plain; charset=utf-8')
                mimeLines.push('')
                mimeLines.push(text)
            } else {
                mimeLines.push('MIME-Version: 1.0')
                mimeLines.push('Content-Type: text/plain; charset=utf-8')
                mimeLines.push('')
                mimeLines.push(text)
            }
        }

        // Add attachments
        if (hasAttachments && options?.attachments) {
            for (const att of options.attachments) {
                mimeLines.push(`--${boundary}`)
                const ct = att.contentType || 'application/octet-stream'
                mimeLines.push(`Content-Type: ${ct}; name="${att.filename}"`)
                mimeLines.push(`Content-Disposition: attachment; filename="${att.filename}"`)
                mimeLines.push('Content-Transfer-Encoding: base64')
                mimeLines.push('')

                let base64Content: string
                if (att.content) {
                    if (Buffer.isBuffer(att.content)) {
                        base64Content = att.content.toString('base64')
                    } else {
                        base64Content = Buffer.from(att.content).toString('base64')
                    }
                } else if (att.path) {
                    const fs = await import('fs/promises')
                    const fileContent = await fs.readFile(att.path)
                    base64Content = fileContent.toString('base64')
                } else {
                    continue
                }
                mimeLines.push(base64Content)
            }
            mimeLines.push(`--${boundary}--`)
        }

        const raw = Buffer.from(mimeLines.join('\r\n')).toString('base64url')

        try {
            const sendParams: gmail_v1.Params$Resource$Users$Messages$Send = {
                userId: 'me',
                requestBody: {
                    raw: raw,
                },
            }

            // Include threadId for replies
            if (options?.threadId) {
                sendParams.requestBody!.threadId = options.threadId
            }

            const response = await this.gmail.users.messages.send(sendParams)

            console.log(`[GmailProvider] Email sent: ${response.data.id}`)

            return {
                messageId: response.data.id || '',
                threadId: response.data.threadId || undefined,
            }
        } catch (error) {
            console.error('[GmailProvider] Failed to send email:', error)
            throw error
        }
    }

    /**
     * Reply to an existing email thread
     */
    public async replyToEmail(
        originalContext: GmailBotContext,
        text: string,
        options?: Omit<GmailSendOptions, 'inReplyTo' | 'references' | 'threadId'>
    ): Promise<{ messageId: string; threadId?: string }> {
        // Build references chain
        const references: string[] = []
        if (originalContext.threadId) {
            references.push(originalContext.threadId)
        }
        if (originalContext.messageId && originalContext.messageId !== originalContext.threadId) {
            references.push(originalContext.messageId)
        }

        // Prepare subject with Re: prefix
        let subject = originalContext.subject
        if (!subject.toLowerCase().startsWith('re:')) {
            subject = `Re: ${subject}`
        }

        return this.sendEmail(originalContext.from, subject, text, {
            ...options,
            inReplyTo: originalContext.messageId,
            references: references,
            threadId: originalContext.threadId,
        })
    }

    /**
     * Download attachment content by Gmail attachment ID
     */
    public async downloadAttachment(gmailId: string, attachmentId: string): Promise<Buffer | null> {
        if (!this.gmail) return null

        try {
            const response = await this.gmail.users.messages.attachments.get({
                userId: 'me',
                messageId: gmailId,
                id: attachmentId,
            })

            if (response.data.data) {
                return Buffer.from(response.data.data, 'base64url')
            }

            return null
        } catch (error) {
            console.error('[GmailProvider] Failed to download attachment:', error)
            return null
        }
    }

    /**
     * Disconnect from Gmail API and stop polling
     */
    public async disconnect(): Promise<void> {
        this.isConnected = false

        if (this.pollingTimer) {
            clearInterval(this.pollingTimer)
            this.pollingTimer = null
        }

        this.gmail = null
        this.processedMessageIds.clear()

        console.log('[GmailProvider] Disconnected')
    }

    /**
     * Check if connected to Gmail API
     */
    public isGmailConnected(): boolean {
        return this.isConnected && this.gmail !== null
    }
}
