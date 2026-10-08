import type { CoreClass } from '@builderbot/bot'
import { createReadStream } from 'node:fs'
import { mkdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'

import { ChatwootApi } from './chatwootApi'
import type {
    BotIncomingMessagePayload,
    BotOutgoingPayload,
    ChatwootBotRef,
    ChatwootInbox,
    ChatwootPluginConfig,
    ChatwootWebhookBody,
} from './types'

const DEFAULT_INBOX_NAME = 'BuilderBot Inbox'
const WEBHOOK_SUBSCRIPTIONS = ['conversation_updated', 'message_created']

/** Maps file extensions to MIME types for correct Content-Type headers when serving media. */
const MIME_MAP: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    mp4: 'video/mp4',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    opus: 'audio/ogg',
    wav: 'audio/wav',
    pdf: 'application/pdf',
    svg: 'image/svg+xml',
}

function mimeFromFilename(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() ?? ''
    return MIME_MAP[ext] ?? 'application/octet-stream'
}

/** Maps WhatsApp `_event_*` body strings to human-readable labels shown in Chatwoot. */
const EVENT_LABELS: Record<string, string> = {
    _event_media_: '[image]',
    _event_voice_note_: '[audio]',
    _event_document_: '[file]',
    _event_location_: '[location]',
    _event_video_: '[video]',
    _event_sticker_: '[sticker]',
    _event_order_: '[order]',
}

/**
 * Converts a WhatsApp provider event string (e.g. `_event_media_`) into a readable label.
 * Returns the original string unchanged for normal text messages.
 */
function normalizeBody(raw: string): string {
    for (const [key, label] of Object.entries(EVENT_LABELS)) {
        if (raw.includes(key)) return label
    }
    return raw
}

/** Returns true if the body string corresponds to a WhatsApp media event. */
function isMediaEvent(raw: string): boolean {
    return Object.keys(EVENT_LABELS).some((key) => raw.includes(key))
}

/**
 * Extracts the real caption from the raw provider message context (e.g. Baileys WAMessage).
 * Baileys always overwrites `body` with `_event_media_` for media messages, but the original
 * caption typed by the user is preserved in `message.imageMessage.caption` (and equivalent
 * fields for video, document, sticker, etc.).
 * Returns the caption string if present and non-empty, otherwise null.
 */
function extractCaption(payload: BotIncomingMessagePayload): string | null {
    const msg = (payload as any).message
    if (!msg) return null
    const caption =
        msg.imageMessage?.caption ||
        msg.videoMessage?.caption ||
        msg.documentMessage?.caption ||
        msg.documentWithCaptionMessage?.message?.documentMessage?.caption ||
        msg.extendedTextMessage?.text ||
        null
    return typeof caption === 'string' && caption.trim() ? caption.trim() : null
}

/**
 * Minimal single-concurrency async queue.
 * Ensures Chatwoot API calls are serialized to avoid race conditions.
 */
class SimpleQueue {
    private running = false
    private tasks: Array<() => Promise<void>> = []

    enqueue(task: () => Promise<void>): void {
        this.tasks.push(task)
        if (!this.running) this.drain()
    }

    private async drain(): Promise<void> {
        this.running = true
        while (this.tasks.length > 0) {
            const task = this.tasks.shift()!
            await task().catch((err) => console.error('[Chatwoot] Queue task error:', err))
        }
        this.running = false
    }
}

const MEDIA_ROUTE = '/media'
const MEDIA_DIR_NAME = join('tmp', 'chatwoot-media')

class ChatwootPlugin {
    private api: ChatwootApi
    private config: ChatwootPluginConfig
    private inbox: ChatwootInbox | null = null
    private conversationCache = new Map<string, number>()
    private contactCache = new Map<string, number>()
    private messageQueue = new SimpleQueue()
    private mediaDir: string | null = null
    private mediaBaseUrl: string | null = null

    /** False if Chatwoot credentials are invalid or unreachable. All operations are skipped when false. */
    public status = true

    constructor(config: ChatwootPluginConfig) {
        this.config = config
        this.api = new ChatwootApi(config)
    }

    /**
     * Conecta el plugin al bot. Una sola línea y listo.
     *
     * ```ts
     * const bot = await createBot({ flow, provider, database })
     * await chatwoot.attach(bot)
     * ```
     */
    async attach(bot: CoreClass): Promise<void> {
        const accountOk = await this.api.checkAccount()
        if (!accountOk) {
            console.error('[Chatwoot] Invalid credentials or unreachable endpoint. Plugin disabled.')
            this.status = false
            return
        }

        const inboxName = this.config.inboxName ?? DEFAULT_INBOX_NAME
        this.inbox = await this.api.findOrCreateInbox(inboxName)
        console.log(`[Chatwoot] Inbox "${this.inbox.name}" ready (id: ${this.inbox.id})`)

        const server = (bot as any).provider?.server

        if (this.config.webhookUrl) {
            const existing = await this.api.findWebhook(this.config.webhookUrl)
            if (!existing) {
                await this.api.createWebhook(this.config.webhookUrl, WEBHOOK_SUBSCRIPTIONS)
                console.log(`[Chatwoot] Webhook registered: ${this.config.webhookUrl}`)
            } else {
                console.log(`[Chatwoot] Webhook already exists (id: ${existing.id})`)
            }

            const urlPath = new URL(this.config.webhookUrl).pathname
            if (server?.post) {
                server.post(urlPath, (req: any, res: any) => {
                    res.writeHead(200, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify({ status: 'ok' }))

                    const botRef = bot as CoreClass & ChatwootBotRef
                    if (typeof (botRef as any).sendMessage !== 'function') {
                        ;(botRef as any).sendMessage = (phone: string, msg: string, opts?: any) =>
                            (bot as any).provider?.sendMessage(phone, msg, opts)
                    }
                    if (!(botRef as any).blacklist) {
                        ;(botRef as any).blacklist = (bot as any).dynamicBlacklist
                    }

                    this.handleWebhook(botRef, req.body ?? {}).catch((err) =>
                        console.error('[Chatwoot] Webhook processing error:', err)
                    )
                })
                console.log(`[Chatwoot] Webhook route auto-registered at ${urlPath}`)
            } else {
                console.warn('[Chatwoot] provider.server not available — register the webhook route manually')
            }

            // Register a public GET route to serve media files downloaded from WhatsApp.
            // Files are stored in tmp/chatwoot-media/ and exposed at /media/:filename
            // so Chatwoot can download them by URL rather than receiving a binary upload.
            if (server?.get) {
                this.mediaDir = join(process.cwd(), MEDIA_DIR_NAME)
                this.mediaBaseUrl = new URL(this.config.webhookUrl).origin
                await mkdir(this.mediaDir, { recursive: true })

                server.get(`${MEDIA_ROUTE}/:filename`, (req: any, res: any) => {
                    const raw = req.params?.filename ?? ''
                    const safeName = raw.replace(/[^a-zA-Z0-9._-]/g, '')
                    if (!safeName) {
                        res.writeHead(400)
                        res.end('Bad request')
                        return
                    }
                    const filePath = join(this.mediaDir!, safeName)
                    const contentType = mimeFromFilename(safeName)
                    const stream = createReadStream(filePath)
                    stream.on('error', () => {
                        res.writeHead(404)
                        res.end('Not found')
                    })
                    res.writeHead(200, { 'Content-Type': contentType })
                    stream.pipe(res)
                })
                console.log(`[Chatwoot] Media route registered at ${MEDIA_ROUTE}/:filename`)
            }
        }

        bot.on('send_message', async (payload) => {
            if (!this.status) return
            if (payload.from?.includes('@g.us')) return

            this.messageQueue.enqueue(async () => {
                const { from, answer } = payload
                if (!from) return

                const rawContent = Array.isArray(answer) ? answer.join('\n') : String(answer ?? '')
                if (rawContent.startsWith('__')) return

                const mediaUrl = (payload as unknown as BotOutgoingPayload).options?.media ?? null
                const content = normalizeBody(rawContent)
                if (!content && !mediaUrl) return

                const conversationId = await this.resolveConversation(from)
                await this.api.sendMessage(conversationId, content, 'outgoing', mediaUrl)
            })
        })

        bot.provider.on('message', async (payload: BotIncomingMessagePayload) => {
            if (!this.status) return
            if (payload.from?.includes('@g.us')) return

            this.messageQueue.enqueue(async () => {
                const { from, body, name } = payload
                if (!from) return

                let mediaUrl: string | null = payload.options?.media ?? null
                let tempFilePath: string | null = null

                // Fallback for providers (e.g. Baileys) that carry the raw WAMessage context
                // but do not populate options.media. Download the file via provider.saveFile,
                // save it to the public media directory and expose it as an HTTP asset so
                // Chatwoot can fetch and store it by URL.
                if (!mediaUrl && body && isMediaEvent(body)) {
                    const saveFile = (bot as any).provider?.saveFile
                    if (typeof saveFile === 'function') {
                        try {
                            if (this.mediaDir && this.mediaBaseUrl) {
                                tempFilePath = await saveFile.call((bot as any).provider, payload, {
                                    path: this.mediaDir,
                                })
                                const filename = tempFilePath!.split('/').pop()
                                mediaUrl = `${this.mediaBaseUrl}${MEDIA_ROUTE}/${filename}`
                            } else {
                                tempFilePath = await saveFile.call((bot as any).provider, payload)
                                mediaUrl = tempFilePath
                            }
                        } catch (err) {
                            console.error('[Chatwoot] Could not download media via saveFile:', err)
                        }
                    }
                }

                if (!body && !mediaUrl) return

                // Prefer the real caption from the raw message context over the normalised label.
                // When a user sends an image with text Baileys sets body to _event_media_ and
                // stores the actual caption inside message.imageMessage.caption (and similar).
                // If there is a media attachment but no caption, send empty content so Chatwoot
                // shows just the image/file preview without a redundant [image] label.
                // Only fall back to the event label when there is no media file at all
                // (e.g. location, sticker, order — events that have no downloadable attachment).
                const caption = extractCaption(payload)
                const content = caption ?? (mediaUrl ? '' : normalizeBody(body ?? ''))
                const conversationId = await this.resolveConversation(from, name)
                await this.api.sendMessage(conversationId, content, 'incoming', mediaUrl)

                if (tempFilePath) {
                    unlink(tempFilePath).catch(() => undefined)
                }
            })
        })

        console.log('[Chatwoot] Plugin attached successfully')
    }

    /**
     * Procesa un webhook entrante desde Chatwoot.
     *
     * Wire this to your HTTP route handler:
     * ```ts
     * server.post('/v1/chatwoot', handleCtx(async (bot, req, res) => {
     *     await chatwoot.handleWebhook(bot, req.body)
     *     res.end(JSON.stringify({ status: 'ok' }))
     * }))
     * ```
     *
     * Handles:
     * - `conversation_updated` + assignee change → add/remove phone from blacklist
     * - `message_created` outgoing on API channel → forward message to WhatsApp
     */
    async handleWebhook(bot: CoreClass & ChatwootBotRef, body: ChatwootWebhookBody): Promise<void> {
        if (!this.inbox) return

        const inboxIdFromBody =
            body?.conversation?.inbox_id ?? body?.inbox?.id ?? body?.conversation?.contact_inbox?.inbox_id

        if (inboxIdFromBody !== undefined && inboxIdFromBody !== this.inbox.id) return

        const changedKeys = body?.changed_attributes?.flatMap((attr) => Object.keys(attr)) ?? []

        if (body?.event === 'conversation_updated' && changedKeys.includes('assignee_id')) {
            const phone = body?.meta?.sender?.phone_number?.replace('+', '')
            const idAssigned = (body?.changed_attributes?.[0] as any)?.assignee_id?.current_value ?? null

            if (phone) {
                if (idAssigned) {
                    bot.blacklist?.add(phone)
                } else if (bot.blacklist?.checkIf(phone)) {
                    bot.blacklist?.remove(phone)
                }
            }
            return
        }

        if (
            body?.private === false &&
            body?.event === 'message_created' &&
            body?.message_type === 'outgoing' &&
            body?.conversation?.channel?.includes('Channel::Api')
        ) {
            const phone = body?.conversation?.meta?.sender?.phone_number?.replace('+', '')
            const content = body?.content ?? ''
            const attachments = body?.attachments ?? []

            if (phone && (content || attachments.length)) {
                const firstMedia = attachments[0]?.data_url ?? null
                await bot.sendMessage(phone, content, { media: firstMedia })

                for (const attachment of attachments.slice(1)) {
                    if (attachment.data_url) {
                        await bot.sendMessage(phone, '', { media: attachment.data_url })
                    }
                }
            }
        }
    }

    /**
     * Resuelve (o crea) el contacto y la conversación en Chatwoot para un número dado.
     */
    private async resolveConversation(phone: string, name?: string): Promise<number> {
        const cached = this.conversationCache.get(phone)
        if (cached) return cached

        let contactId = this.contactCache.get(phone)
        if (!contactId) {
            const contact = await this.api.findOrCreateContact(phone, name)
            if (!contact?.id) throw new Error(`[Chatwoot] Could not resolve contact for ${phone}`)
            contactId = contact.id!
            this.contactCache.set(phone, contactId)
        }

        if (!this.inbox) throw new Error('[Chatwoot] Plugin not attached yet. Call attach() first.')
        const conversation = await this.api.findOrCreateConversation(contactId, this.inbox.id)
        this.conversationCache.set(phone, conversation.id)

        return conversation.id
    }

    /**
     * Acceso directo a la API de Chatwoot para operaciones avanzadas.
     */
    getApi(): ChatwootApi {
        return this.api
    }

    /**
     * Retorna el inbox creado por el plugin.
     */
    getInbox(): ChatwootInbox | null {
        return this.inbox
    }
}

/**
 * Crea una instancia del plugin de Chatwoot.
 *
 * ```ts
 * const chatwoot = createChatwootPlugin({
 *     token: 'tu-token',
 *     url: 'https://app.chatwoot.com',
 *     accountId: 1,
 *     webhookUrl: 'https://mi-bot.example.com/v1/chatwoot',
 * })
 *
 * const bot = await createBot({ flow, provider, database })
 * await chatwoot.attach(bot)
 * ```
 */
const createChatwootPlugin = (config: ChatwootPluginConfig): ChatwootPlugin => {
    return new ChatwootPlugin(config)
}

export { ChatwootPlugin, createChatwootPlugin }
