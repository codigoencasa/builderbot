/**
 * LAYER: Infrastructure
 * Contains: GupshupProvider, AxiosInstance
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(n^2) score:1
 * keywords: [GupshupProvider, AxiosInstance]
 * GOAL: Own the "provider" concern of the provider-gupshup package.
 */
import { ProviderClass, utils } from '@builderbot/bot'
import { Vendor } from '@builderbot/bot/dist/provider/interface/provider'
import { BotContext, Button, SendOptions } from '@builderbot/bot/dist/types'
import axios, { AxiosInstance } from 'axios'
import mime from 'mime-types'
import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'

import { GupshupCoreVendor } from './core'
import {
    GupshupCompatibleListMessage,
    GupshupCtaMessage,
    GupshupFlowSendRequest,
    GupshupGlobalVendorArgs,
    GupshupListMessage,
    GupshupLocationMessage,
    GupshupLocationRequestMessage,
    GupshupMetaTemplateComponent,
    GupshupMetaTemplatePassthroughRequest,
    GupshupReactionMessage,
    GupshupSessionSendOptions,
    GupshupTemplateLanguageOrComponents,
    GupshupTemplateSendRequest,
} from '../types'
import { extractFileNameFromInput, inferSessionMediaTypeFromInput, isHttpUrl } from '../utils/media'

const SESSION_BASE_URL = 'https://api.gupshup.io/wa/api/v1'
const APP_BASE_URL = 'https://api.gupshup.io/wa/app'
const PARTNER_BASE_URL = 'https://partner.gupshup.io'
const PARTNER_APP_CONFIG_REQUIRED_ERROR = 'Partner app config is required. Provide partner.appId and partner.appToken.'
const GUPSHUP_CHANNEL = 'whatsapp'
const MAX_QUICK_REPLY_OPTIONS = 3
const LOCAL_MEDIA_ROUTE_BASE = '/local-media'
const DEFAULT_LOCAL_MEDIA_TTL_MS = 5 * 60 * 1000
const TRUSTED_MEDIA_HOST_SUFFIX = '.gupshup.io'
const CLOUD_ENV_HINTS = [
    'K_SERVICE',
    'K_REVISION',
    'WEBSITE_SITE_NAME',
    'RENDER',
    'RAILWAY_ENVIRONMENT',
    'DYNO',
    'VERCEL',
]

type LocalMediaRegistration = {
    absolutePath: string
    expiresAt: number
}

type NormalizedSendOptions = SendOptions & GupshupSessionSendOptions

export class GupshupProvider extends ProviderClass<GupshupCoreVendor> {
    public vendor: Vendor<GupshupCoreVendor>
    public globalVendorArgs: GupshupGlobalVendorArgs = {
        name: 'bot',
        port: 3000,
        apiKey: '',
        srcName: '',
        phoneNumber: '',
        appId: '',
        logs: {
            inbound: false,
            status: 'failed',
            outboundErrors: true,
            rawOnFailed: false,
        },
    }
    private http: AxiosInstance
    private readonly localMediaRegistry = new Map<string, LocalMediaRegistration>()
    private inferredPublicBaseUrl: string | null = null

    constructor(args: GupshupGlobalVendorArgs) {
        super()
        this.globalVendorArgs = {
            ...this.globalVendorArgs,
            ...args,
            logs: {
                ...this.globalVendorArgs.logs,
                ...args?.logs,
            },
        }

        this.http = axios.create({
            baseURL: SESSION_BASE_URL,
            headers: {
                apikey: this.globalVendorArgs.apiKey,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        })
    }

    protected beforeHttpServerInit(): void {
        this.server = this.server
            .use((req, _, next) => {
                req['globalVendorArgs'] = this.globalVendorArgs
                this.captureInferredBaseUrl(req)
                return next()
            })
            .get(`${LOCAL_MEDIA_ROUTE_BASE}/:token`, this.serveRegisteredLocalMedia)
            .post('/webhook', this.vendor.incomingMsg)
    }

    protected async afterHttpServerInit(): Promise<void> {
        try {
            this.emit('ready')
            this.emit('notice', {
                title: '🟢 Gupshup Provider Ready',
                instructions: ['Webhook URI: /webhook'],
            })
        } catch (error) {
            console.error(error)
        }
    }

    protected initVendor(): Promise<GupshupCoreVendor> {
        const vendor = new GupshupCoreVendor(this.globalVendorArgs)
        this.vendor = vendor
        return Promise.resolve(vendor)
    }

    protected busEvents = () => [
        { event: 'message', func: (payload: BotContext) => this.emit('message', payload) },
        { event: 'notice', func: (payload: any) => this.emit('notice', payload) },
        { event: 'status', func: (payload: any) => this.emit('status', payload) },
    ]

    private normalizeSendOptions = (options?: SendOptions): NormalizedSendOptions => {
        const rawOptions = options ?? {}
        const nestedOptions =
            typeof rawOptions.options === 'object' && rawOptions.options !== null
                ? (rawOptions.options as Record<string, unknown>)
                : {}

        return {
            ...rawOptions,
            ...nestedOptions,
        }
    }

    private getLocalMediaTtlMs = (): number => {
        const configuredTtl = this.globalVendorArgs.localMedia?.ttlMs
        if (typeof configuredTtl !== 'number' || configuredTtl <= 0) {
            return DEFAULT_LOCAL_MEDIA_TTL_MS
        }

        return configuredTtl
    }

    private normalizeBaseUrl = (url: string): string => {
        return url.replace(/\/+$/, '')
    }

    private sanitizeProtocol = (value?: string): 'http' | 'https' | null => {
        if (typeof value !== 'string' || !value.trim()) return null

        const normalizedValue = value.split(',')[0].trim().toLowerCase()
        if (normalizedValue === 'http' || normalizedValue === 'https') {
            return normalizedValue
        }

        return null
    }

    private sanitizeHost = (value?: string): string | null => {
        if (typeof value !== 'string' || !value.trim()) return null

        const normalizedValue = value.split(',')[0].trim()
        const hostRegex = /^(\[[a-fA-F0-9:]+\]|[a-zA-Z0-9.-]+)(:\d{1,5})?$/

        if (!hostRegex.test(normalizedValue)) {
            return null
        }

        return normalizedValue
    }

    private isTrustedInferredHostname = (hostname: string): boolean => {
        const normalizedHostname = hostname.toLowerCase()
        return normalizedHostname === 'localhost' || normalizedHostname === '127.0.0.1' || normalizedHostname === '::1'
    }

    private toSafeBaseUrl = (protocol: 'http' | 'https', host: string): string | null => {
        try {
            const parsedUrl = new URL(`${protocol}://${host}`)
            if (!this.isTrustedInferredHostname(parsedUrl.hostname)) {
                return null
            }

            return this.normalizeBaseUrl(parsedUrl.origin)
        } catch {
            return null
        }
    }

    private getHeader = (req: any, headerName: string): string | undefined => {
        const rawValue = req?.headers?.[headerName]
        if (typeof rawValue === 'string') return rawValue
        if (Array.isArray(rawValue) && typeof rawValue[0] === 'string') return rawValue[0]
        return undefined
    }

    private inferBaseUrlFromRequest = (req: any): string | null => {
        const forwardedHost = this.sanitizeHost(this.getHeader(req, 'x-forwarded-host'))
        const directHost = this.sanitizeHost(this.getHeader(req, 'host'))
        const host = forwardedHost ?? directHost
        if (!host) return null

        const forwardedProtocol = this.sanitizeProtocol(this.getHeader(req, 'x-forwarded-proto'))
        const requestProtocol = this.sanitizeProtocol(typeof req?.protocol === 'string' ? req.protocol : undefined)
        const protocol = forwardedProtocol ?? requestProtocol
        if (!protocol) return null

        return this.toSafeBaseUrl(protocol, host)
    }

    private captureInferredBaseUrl = (req: any): void => {
        const inferredBaseUrl = this.inferBaseUrlFromRequest(req)
        if (inferredBaseUrl) {
            this.inferredPublicBaseUrl = inferredBaseUrl
        }
    }

    private resolvePublicBaseUrl = (): string => {
        const configuredPublicUrl = this.globalVendorArgs.publicUrl
        if (typeof configuredPublicUrl === 'string' && configuredPublicUrl.trim()) {
            try {
                const parsedUrl = new URL(configuredPublicUrl.trim())
                const protocol = this.sanitizeProtocol(parsedUrl.protocol.replace(':', ''))
                const host = this.sanitizeHost(parsedUrl.host)
                if (protocol && host) {
                    return this.normalizeBaseUrl(parsedUrl.origin)
                }
            } catch {
                // Ignore invalid public URL and fallback to safe defaults
            }
        }

        if (this.inferredPublicBaseUrl) {
            return this.inferredPublicBaseUrl
        }

        const isProductionRuntime = process.env.NODE_ENV === 'production'
        const hasCloudHint = CLOUD_ENV_HINTS.some(
            (envName) => typeof process.env[envName] === 'string' && process.env[envName]
        )

        if (isProductionRuntime || hasCloudHint) {
            throw new Error('publicUrl is required to serve local media in production/cloud environments')
        }

        return `http://localhost:${this.globalVendorArgs.port}`
    }

    private pruneLocalMediaRegistry = (now: number = Date.now()): void => {
        for (const [token, registration] of this.localMediaRegistry) {
            if (registration.expiresAt <= now) {
                this.localMediaRegistry.delete(token)
            }
        }
    }

    private registerLocalMedia = (mediaInput: string): string => {
        const absolutePath = resolve(mediaInput)
        const token = randomUUID()
        const now = Date.now()

        this.pruneLocalMediaRegistry(now)
        this.localMediaRegistry.set(token, {
            absolutePath,
            expiresAt: now + this.getLocalMediaTtlMs(),
        })

        return `${this.resolvePublicBaseUrl()}${LOCAL_MEDIA_ROUTE_BASE}/${token}`
    }

    private serveRegisteredLocalMedia = async (req: any, res: any): Promise<void> => {
        const token = req?.params?.token

        if (!token || typeof token !== 'string') {
            res.statusCode = 404
            res.end('Not Found')
            return
        }

        this.pruneLocalMediaRegistry()
        const registration = this.localMediaRegistry.get(token)
        if (!registration) {
            res.statusCode = 404
            res.end('Not Found')
            return
        }

        try {
            const fileStats = await stat(registration.absolutePath)
            if (!fileStats.isFile()) {
                res.statusCode = 404
                res.end('Not Found')
                return
            }

            const contentType = mime.lookup(registration.absolutePath)
            if (typeof contentType === 'string') {
                res.setHeader('Content-Type', contentType)
            } else {
                res.setHeader('Content-Type', 'application/octet-stream')
            }

            res.setHeader('Content-Length', String(fileStats.size))

            const stream = createReadStream(registration.absolutePath)
            stream.on('error', () => {
                if (!res.headersSent) {
                    res.statusCode = 500
                    res.end('Error')
                }
            })
            stream.pipe(res)
        } catch {
            res.statusCode = 404
            res.end('Not Found')
        }
    }

    private shouldLogOutboundErrors = (): boolean => {
        return this.globalVendorArgs.logs?.outboundErrors ?? true
    }

    private formatOutboundError = (error: unknown): string => {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status
            const details = JSON.stringify(error.response?.data ?? error.message)
            return `Gupshup API error${status ? ` (${status})` : ''}: ${details}`
        }

        if (error instanceof Error) return error.message

        return 'Unknown outbound error'
    }

    private emitOutboundErrorNotice = (to: string, messageType: string, error: unknown): void => {
        if (!this.shouldLogOutboundErrors()) return

        this.emit('notice', {
            title: '🔔  GUPSHUP ALERT  🔔',
            instructions: [`Outbound failed (${messageType})`, `To: ${to}`, this.formatOutboundError(error)],
        })
    }

    private createReplyContext = (replyTo?: string): Record<string, unknown> => {
        if (!replyTo) return {}

        return {
            context: {
                msgId: replyTo,
            },
        }
    }

    private buildSessionBody = (
        to: string,
        message: Record<string, unknown>,
        includeSrcName = true
    ): URLSearchParams => {
        const body = new URLSearchParams()
        body.append('channel', GUPSHUP_CHANNEL)
        body.append('source', this.globalVendorArgs.phoneNumber)
        body.append('destination', to)

        if (includeSrcName && this.globalVendorArgs.srcName) {
            body.append('src.name', this.globalVendorArgs.srcName)
        }

        body.append('message', JSON.stringify(message))
        return body
    }

    private postSessionMessage = async (
        to: string,
        payload: Record<string, unknown>,
        messageType: string,
        includeSrcName = true
    ): Promise<any> => {
        const body = this.buildSessionBody(to, payload, includeSrcName)

        try {
            const response = await this.http.post('/msg', body)
            return response.data
        } catch (error) {
            this.emitOutboundErrorNotice(to, messageType, error)
            throw error
        }
    }

    private resolveMediaUrlFromApiPayload = (payload: any): string | null => {
        const candidates = [
            payload?.url,
            payload?.mediaUrl,
            payload?.downloadUrl,
            payload?.originalUrl,
            payload?.data?.url,
            payload?.data?.mediaUrl,
            payload?.payload?.url,
        ]

        const foundUrl = candidates.find((value) => typeof value === 'string' && value.length > 0)
        return foundUrl ?? null
    }

    private resolveMediaUrlFromId = async (mediaId: string): Promise<string | null> => {
        if (!mediaId) return null

        const appId = this.globalVendorArgs.appId
        const endpoints = [
            `${SESSION_BASE_URL}/media/${encodeURIComponent(mediaId)}`,
            `${SESSION_BASE_URL}/msg/${encodeURIComponent(mediaId)}`,
            ...(appId ? [`${APP_BASE_URL}/${encodeURIComponent(appId)}/media/${encodeURIComponent(mediaId)}`] : []),
        ]

        for (const endpoint of endpoints) {
            try {
                const response = await axios.get(endpoint, {
                    headers: {
                        apikey: this.globalVendorArgs.apiKey,
                    },
                })

                const mediaUrl = this.resolveMediaUrlFromApiPayload(response.data)
                if (mediaUrl) return mediaUrl
            } catch {
                continue
            }
        }

        return null
    }

    private resolveMediaUrlFromContext = async (
        ctx: Partial<BotContext> & { mediaId?: string }
    ): Promise<string | null> => {
        const url =
            (typeof ctx?.url === 'string' && ctx.url.length > 0 ? ctx.url : null) ??
            ((ctx as any)?.data?.media?.url as string | undefined) ??
            null

        if (url) return url

        const mediaId =
            (typeof ctx?.mediaId === 'string' && ctx.mediaId.length > 0 ? ctx.mediaId : null) ??
            ((ctx as any)?.id as string | undefined) ??
            null

        if (!mediaId) return null

        return this.resolveMediaUrlFromId(mediaId)
    }

    private assertRemoteMediaUrl = (mediaInput: string): string => {
        if (isHttpUrl(mediaInput)) return mediaInput

        throw new Error('Gupshup session messages require a public URL for media payloads')
    }

    private resolveMediaInput = async (mediaInput: string): Promise<string> => {
        if (isHttpUrl(mediaInput)) return mediaInput

        if (!this.globalVendorArgs.resolveMediaUrl) {
            return this.registerLocalMedia(mediaInput)
        }

        const resolvedInput = await this.globalVendorArgs.resolveMediaUrl(mediaInput)

        return this.assertRemoteMediaUrl(resolvedInput)
    }

    private shouldAttachApiKeyForMediaUrl = (mediaUrl: string): boolean => {
        try {
            const parsedUrl = new URL(mediaUrl)
            if (parsedUrl.protocol !== 'https:') {
                return false
            }

            const hostname = parsedUrl.hostname.toLowerCase()
            return hostname === 'gupshup.io' || hostname.endsWith(TRUSTED_MEDIA_HOST_SUFFIX)
        } catch {
            return false
        }
    }

    private isMetaListPayload = (
        list: GupshupCompatibleListMessage
    ): list is Extract<GupshupCompatibleListMessage, { type: 'list' }> => {
        return (list as any)?.type === 'list' && Array.isArray((list as any)?.action?.sections)
    }

    private normalizeListPayload = (list: GupshupCompatibleListMessage): GupshupListMessage => {
        if (!this.isMetaListPayload(list)) return list

        const bodyParts = [list.body?.text, list.footer?.text].filter(
            (value): value is string => typeof value === 'string' && value.trim().length > 0
        )

        return {
            title: list.header?.text,
            body: bodyParts.join('\n'),
            buttonTitle: list.action.button,
            items: list.action.sections.map((section) => ({
                title: section.title,
                options: section.rows.map((row) => ({
                    title: row.title,
                    description: row.description,
                    postbackText: row.id || row.title,
                })),
            })),
        }
    }

    private buildQuickReplyOptions = (buttons: Button[] = []): Array<{ title: string; postbackText: string }> => {
        const parsedButtons = buttons
            .map((button) => {
                const title = String(button?.body ?? '').trim()
                const postbackText = String((button as any)?.payload ?? title).trim()

                if (!title) return null

                return {
                    title,
                    postbackText,
                }
            })
            .filter((button): button is { title: string; postbackText: string } => Boolean(button))

        return parsedButtons.slice(0, MAX_QUICK_REPLY_OPTIONS)
    }

    public sendMessage = async (to: string, message: string, options?: SendOptions): Promise<any> => {
        const normalizedOptions = this.normalizeSendOptions(options)

        if (normalizedOptions.flow) {
            return this.sendFlow(to, normalizedOptions.flow)
        }

        if (normalizedOptions.templatePassthrough) {
            return this.sendTemplatePassthrough(to, normalizedOptions.templatePassthrough)
        }

        if (normalizedOptions.template) {
            return this.sendTemplate(to, normalizedOptions.template)
        }

        if (normalizedOptions.reaction) {
            return this.sendReaction(to, normalizedOptions.reaction)
        }

        if (normalizedOptions.locationRequest) {
            const locationRequestBody =
                typeof normalizedOptions.locationRequest === 'string'
                    ? normalizedOptions.locationRequest
                    : normalizedOptions.locationRequest.bodyText

            return this.sendLocationRequest(to, locationRequestBody ?? message)
        }

        if (normalizedOptions.location) {
            return this.sendLocation(to, normalizedOptions.location)
        }

        if (normalizedOptions.list) {
            if ((normalizedOptions.list as any)?.type === 'list') {
                const metaList = normalizedOptions.list as Extract<GupshupCompatibleListMessage, { type: 'list' }>

                return this.sendList(to, {
                    ...metaList,
                    body: {
                        ...metaList.body,
                        text: metaList.body?.text ?? message,
                    },
                })
            }

            return this.sendList(to, {
                ...(normalizedOptions.list as GupshupListMessage),
                body: (normalizedOptions.list as GupshupListMessage).body ?? message,
            })
        }

        if (normalizedOptions.ctaUrl) {
            return this.sendCtaUrl(to, normalizedOptions.ctaUrl, message)
        }

        if (normalizedOptions.buttons?.length) {
            return this.sendButtons(to, message, normalizedOptions.buttons, normalizedOptions)
        }

        if (normalizedOptions.media) {
            return this.sendMedia(to, message, normalizedOptions.media, normalizedOptions)
        }

        return this.sendText(to, message, normalizedOptions)
    }

    public saveFile = async (
        ctx: Partial<BotContext> & { mediaId?: string },
        options?: { path: string }
    ): Promise<string> => {
        try {
            const mediaUrl = await this.resolveMediaUrlFromContext(ctx)
            if (!mediaUrl) return 'ERROR'

            const requestHeaders = this.shouldAttachApiKeyForMediaUrl(mediaUrl)
                ? {
                      apikey: this.globalVendorArgs.apiKey,
                  }
                : undefined

            const localPath = await utils.generalDownload(mediaUrl, options?.path, requestHeaders)

            return localPath
        } catch (error) {
            console.error('[Gupshup] Error saving file:', error instanceof Error ? error.message : error)
            return 'ERROR'
        }
    }

    public sendText = async (to: string, text: string, options: GupshupSessionSendOptions = {}): Promise<any> => {
        const payload = {
            type: 'text',
            text,
            previewUrl: options.previewUrl ?? false,
            ...this.createReplyContext(options.replyTo),
        }

        return this.postSessionMessage(to, payload, 'text')
    }

    public sendMedia = async (
        to: string,
        caption: string,
        mediaInput: string,
        options: GupshupSessionSendOptions = {}
    ): Promise<any> => {
        const mediaUrl = await this.resolveMediaInput(mediaInput)
        const inferredMediaTypeFromInput = inferSessionMediaTypeFromInput(mediaInput, 'image')
        const inferredMediaType = inferSessionMediaTypeFromInput(mediaUrl, inferredMediaTypeFromInput)
        const mediaType = options.mediaType ?? inferredMediaType
        const context = this.createReplyContext(options.replyTo)

        let payload: Record<string, unknown>

        switch (mediaType) {
            case 'image':
                payload = {
                    type: 'image',
                    originalUrl: mediaUrl,
                    previewUrl: mediaUrl,
                    caption,
                    ...context,
                }
                break

            case 'video':
                payload = {
                    type: 'video',
                    url: mediaUrl,
                    previewUrl: mediaUrl,
                    caption,
                    ...context,
                }
                break

            case 'audio':
                payload = {
                    type: 'audio',
                    url: mediaUrl,
                    ...context,
                }
                break

            case 'sticker':
                payload = {
                    type: 'sticker',
                    url: mediaUrl,
                    ...context,
                }
                break

            case 'file':
            default:
                payload = {
                    type: 'file',
                    url: mediaUrl,
                    filename: options.filename ?? extractFileNameFromInput(mediaUrl),
                    caption,
                    ...context,
                }
                break
        }

        return this.postSessionMessage(to, payload, mediaType)
    }

    public sendButtons = async (
        to: string,
        text: string,
        buttons: Button[] = [],
        options: GupshupSessionSendOptions = {}
    ): Promise<any> => {
        const parsedButtons = this.buildQuickReplyOptions(buttons)
        if (!parsedButtons.length) {
            throw new Error('Gupshup quick replies require at least one button with text')
        }

        const payload: Record<string, unknown> = {
            type: 'quick_reply',
            content: {
                type: 'text',
                text,
            },
            options: parsedButtons,
        }

        if (options.replyTo) {
            payload.msgid = options.replyTo
        }

        return this.postSessionMessage(to, payload, 'quick_reply')
    }

    public sendImage = async (
        to: string,
        mediaInput: string,
        caption = '',
        options: GupshupSessionSendOptions = {}
    ): Promise<any> => {
        return this.sendMedia(to, caption, mediaInput, {
            ...options,
            mediaType: 'image',
        })
    }

    public sendFile = async (
        to: string,
        mediaInput: string,
        caption = '',
        options: GupshupSessionSendOptions = {}
    ): Promise<any> => {
        return this.sendMedia(to, caption, mediaInput, {
            ...options,
            mediaType: 'file',
        })
    }

    public sendButtonUrl = async (
        to: string,
        button: { body?: string; text?: string; url: string },
        body?: string | string[]
    ): Promise<any> => {
        const fallbackBody = Array.isArray(body) ? body.join('\n') : (body ?? '')

        return this.sendCtaUrl(
            to,
            {
                display_text: button.body || button.text || 'Abrir enlace',
                url: button.url,
            },
            fallbackBody
        )
    }

    public sendList = async (to: string, list: GupshupCompatibleListMessage): Promise<any> => {
        const normalizedList = this.normalizeListPayload(list)

        if (!normalizedList.items?.length) {
            throw new Error('Gupshup list messages require at least one section with options')
        }

        const payload: Record<string, unknown> = {
            type: 'list',
            title: normalizedList.title ?? 'Menu',
            body: normalizedList.body ?? '',
            globalButtons: [
                {
                    type: 'text',
                    title: normalizedList.buttonTitle ?? 'Options',
                },
            ],
            items: normalizedList.items.map((item) => ({
                title: item.title ?? '',
                options: item.options.map((option) => ({
                    type: 'text',
                    title: option.title,
                    description: option.description,
                    postbackText: option.postbackText ?? option.title,
                    ...(typeof option.encodeText === 'boolean' ? { encodeText: option.encodeText } : {}),
                })),
            })),
        }

        if (normalizedList.msgid) {
            payload.msgid = normalizedList.msgid
        }

        return this.postSessionMessage(to, payload, 'list')
    }

    public sendLocation = async (to: string, location: GupshupLocationMessage): Promise<any> => {
        const payload = {
            type: 'location',
            longitude: String(location.longitude),
            latitude: String(location.latitude),
            ...(location.name ? { name: location.name } : {}),
            ...(location.address ? { address: location.address } : {}),
        }

        return this.postSessionMessage(to, payload, 'location')
    }

    public sendLocationRequest = async (to: string, bodyText: string | GupshupLocationRequestMessage): Promise<any> => {
        const parsedBodyText = typeof bodyText === 'string' ? bodyText : bodyText.bodyText

        if (!parsedBodyText?.trim()) {
            throw new Error('Location request body text is required')
        }

        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'interactive',
            interactive: {
                type: 'location_request_message',
                body: {
                    text: parsedBodyText.trim(),
                },
                action: {
                    name: 'send_location',
                },
            },
        }

        return this.postPartnerPassthroughMessage(to, payload, 'location_request')
    }

    public requestLocation = async (to: string, bodyText: string): Promise<any> => {
        return this.sendLocationRequest(to, bodyText)
    }

    private normalizeReactionMessageId = (reaction: GupshupReactionMessage): string => {
        const messageId = reaction.msgId ?? reaction.messageId ?? reaction.message_id
        if (!messageId) {
            throw new Error('Reaction message id is required')
        }

        return messageId
    }

    public sendReaction = async (to: string, reaction: GupshupReactionMessage): Promise<any> => {
        const payload = {
            type: 'reaction',
            emoji: reaction.emoji,
            msgId: this.normalizeReactionMessageId(reaction),
        }

        return this.postSessionMessage(to, payload, 'reaction')
    }

    public sendCtaUrl = async (to: string, ctaMessage: GupshupCtaMessage, fallbackBody = ''): Promise<any> => {
        const payload: Record<string, unknown> = {
            type: 'cta_url',
            body: ctaMessage.body ?? fallbackBody,
            display_text: ctaMessage.display_text,
            url: ctaMessage.url,
        }

        if (ctaMessage.footer) {
            payload.footer = ctaMessage.footer
        }

        if (ctaMessage.header) {
            payload.header = ctaMessage.header
        }

        return this.postSessionMessage(to, payload, 'cta_url')
    }

    private normalizeTemplateRequest = (
        templateInput: GupshupTemplateSendRequest | string,
        languageCodeOrComponents?: GupshupTemplateLanguageOrComponents,
        componentsInput: GupshupMetaTemplateComponent[] = []
    ): GupshupTemplateSendRequest => {
        if (typeof templateInput !== 'string') {
            return templateInput
        }

        const languageCode = typeof languageCodeOrComponents === 'string' ? languageCodeOrComponents : undefined
        const components = Array.isArray(languageCodeOrComponents) ? languageCodeOrComponents : componentsInput

        const params = components
            .flatMap((component) => (Array.isArray(component?.parameters) ? component.parameters : []))
            .map((parameter) => {
                if (typeof parameter?.text === 'string') return parameter.text
                if (typeof parameter?.payload === 'string') return parameter.payload
                return ''
            })
            .filter((value) => value.length > 0)

        return {
            template: {
                id: templateInput,
                ...(languageCode ? { languageCode } : {}),
                ...(params.length ? { params } : {}),
            },
        }
    }

    private getTemplateComponentsFromSignature = (
        languageCodeOrComponents?: GupshupTemplateLanguageOrComponents,
        componentsInput: GupshupMetaTemplateComponent[] = []
    ): GupshupMetaTemplateComponent[] => {
        if (Array.isArray(languageCodeOrComponents)) {
            return languageCodeOrComponents
        }

        return componentsInput
    }

    private hasFlowTemplateActionComponent = (components: GupshupMetaTemplateComponent[] = []): boolean => {
        return components.some((component) => {
            if (!Array.isArray(component?.parameters)) return false

            return component.parameters.some(
                (parameter) =>
                    parameter?.type === 'action' &&
                    typeof (parameter as any)?.action === 'object' &&
                    typeof ((parameter as any).action as Record<string, unknown>)?.flow_token === 'string'
            )
        })
    }

    private normalizeTemplatePassthroughLanguage = (
        language: string | Record<string, unknown>
    ): Record<string, unknown> => {
        if (typeof language === 'string') {
            return { code: language }
        }

        return language
    }

    private normalizeTemplatePassthroughComponents = (
        components: GupshupMetaTemplateComponent[] = []
    ): GupshupMetaTemplateComponent[] => {
        return components.map((component) => {
            const hasFlowActionParameter = Array.isArray(component?.parameters)
                ? component.parameters.some(
                      (parameter) =>
                          parameter?.type === 'action' &&
                          typeof (parameter as any)?.action === 'object' &&
                          typeof ((parameter as any).action as Record<string, unknown>)?.flow_token === 'string'
                  )
                : false

            if (!hasFlowActionParameter) {
                return component
            }

            const currentIndex = (component as any)?.index
            const trimmedStringIndex = typeof currentIndex === 'string' ? currentIndex.trim() : ''
            const normalizedIndex =
                typeof currentIndex === 'number'
                    ? String(currentIndex)
                    : trimmedStringIndex.length > 0
                      ? trimmedStringIndex
                      : '0'

            return {
                ...component,
                type: 'button',
                sub_type: 'flow',
                index: normalizedIndex,
            }
        })
    }

    private isLikelyUuid = (value: string): boolean => {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    }

    private isLikelyNumericIdentifier = (value: string): boolean => {
        return /^\d+$/.test(value)
    }

    private assertValidFlowTemplatePassthroughName = (templateName: string): void => {
        const normalizedTemplateName = templateName.trim()

        if (this.isLikelyUuid(normalizedTemplateName) || this.isLikelyNumericIdentifier(normalizedTemplateName)) {
            throw new Error(
                'Flow template passthrough expects template name (not a UUID/numeric template id). Use template.name from Meta.'
            )
        }
    }

    private getPartnerConfig = (): { appId: string; appToken: string; baseUrl: string } | null => {
        const appId = this.globalVendorArgs.partner?.appId?.trim()
        const appToken = this.globalVendorArgs.partner?.appToken?.trim()

        if (!appId || !appToken) {
            return null
        }

        return {
            appId,
            appToken,
            baseUrl: (this.globalVendorArgs.partner?.baseUrl ?? PARTNER_BASE_URL).replace(/\/+$/, ''),
        }
    }

    private postPartnerPassthroughMessage = async (
        to: string,
        payload: Record<string, unknown>,
        messageType: string
    ): Promise<any> => {
        const partnerConfig = this.getPartnerConfig()

        if (!partnerConfig) {
            throw new Error(PARTNER_APP_CONFIG_REQUIRED_ERROR)
        }

        const body = new URLSearchParams()

        for (const [key, value] of Object.entries(payload)) {
            if (value === undefined || value === null) {
                continue
            }

            if (typeof value === 'object') {
                body.append(key, JSON.stringify(value))
                continue
            }

            body.append(key, String(value))
        }

        try {
            const response = await axios.post(
                `${partnerConfig.baseUrl}/partner/app/${encodeURIComponent(partnerConfig.appId)}/v3/message`,
                body,
                {
                    headers: {
                        Authorization: partnerConfig.appToken,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            )

            return response.data
        } catch (error) {
            this.emitOutboundErrorNotice(to, messageType, error)
            throw error
        }
    }

    public sendFlow = async (to: string, flowRequest: GupshupFlowSendRequest): Promise<any> => {
        if (!flowRequest.flowId) {
            throw new Error('Flow id is required to send flow messages')
        }

        if (!flowRequest.flowToken) {
            throw new Error('Flow token is required to send flow messages')
        }

        if (!flowRequest.flowCta) {
            throw new Error('Flow CTA is required to send flow messages')
        }

        const payload: Record<string, unknown> = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'interactive',
            interactive: {
                type: 'flow',
                ...(flowRequest.header
                    ? {
                          header: {
                              type: 'text',
                              text: flowRequest.header,
                          },
                      }
                    : {}),
                ...(flowRequest.body
                    ? {
                          body: {
                              text: flowRequest.body,
                          },
                      }
                    : {}),
                ...(flowRequest.footer
                    ? {
                          footer: {
                              text: flowRequest.footer,
                          },
                      }
                    : {}),
                action: {
                    name: 'flow',
                    parameters: {
                        flow_message_version: flowRequest.flowMessageVersion ?? '3',
                        flow_token: flowRequest.flowToken,
                        flow_id: flowRequest.flowId,
                        flow_cta: flowRequest.flowCta,
                        flow_action: flowRequest.flowAction ?? 'navigate',
                        ...(flowRequest.flowActionPayload
                            ? { flow_action_payload: flowRequest.flowActionPayload }
                            : {}),
                        ...(flowRequest.isDraftFlow ? { mode: 'draft' } : {}),
                    },
                },
            },
        }

        return this.postPartnerPassthroughMessage(to, payload, 'flow')
    }

    public sendTemplatePassthrough = async (
        to: string,
        templateRequest: GupshupMetaTemplatePassthroughRequest
    ): Promise<any> => {
        const normalizedComponents = templateRequest.components
            ? this.normalizeTemplatePassthroughComponents(templateRequest.components)
            : undefined
        const hasFlowTemplateActionComponent = this.hasFlowTemplateActionComponent(normalizedComponents)

        if (hasFlowTemplateActionComponent) {
            this.assertValidFlowTemplatePassthroughName(templateRequest.name)
        }

        const payload: Record<string, unknown> = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'template',
            template: {
                name: templateRequest.name,
                language: this.normalizeTemplatePassthroughLanguage(templateRequest.language),
                ...(normalizedComponents ? { components: normalizedComponents } : {}),
            },
        }

        return this.postPartnerPassthroughMessage(to, payload, 'template_passthrough')
    }

    public sendTemplate(to: string, templateRequest: GupshupTemplateSendRequest): Promise<any>
    public sendTemplate(to: string, template: string, components: GupshupMetaTemplateComponent[]): Promise<any>
    public sendTemplate(
        to: string,
        template: string,
        languageCode?: string,
        components?: GupshupMetaTemplateComponent[]
    ): Promise<any>
    public async sendTemplate(
        to: string,
        templateOrRequest: GupshupTemplateSendRequest | string,
        languageCodeOrComponents?: GupshupTemplateLanguageOrComponents,
        components: GupshupMetaTemplateComponent[] = []
    ): Promise<any> {
        if (typeof templateOrRequest === 'string') {
            const parsedComponents = this.getTemplateComponentsFromSignature(languageCodeOrComponents, components)
            const hasFlowTemplateActionComponent = this.hasFlowTemplateActionComponent(parsedComponents)

            if (hasFlowTemplateActionComponent) {
                const partnerConfig = this.getPartnerConfig()
                if (!partnerConfig) {
                    throw new Error(PARTNER_APP_CONFIG_REQUIRED_ERROR)
                }

                const language =
                    typeof languageCodeOrComponents === 'string'
                        ? { code: languageCodeOrComponents }
                        : ({ code: 'en_US' } as Record<string, unknown>)

                return this.sendTemplatePassthrough(to, {
                    name: templateOrRequest,
                    language,
                    components: parsedComponents,
                })
            }
        }

        const templateRequest = this.normalizeTemplateRequest(templateOrRequest, languageCodeOrComponents, components)
        const { template, message, postbackTexts } = templateRequest

        if (!template?.id) {
            throw new Error('Template id is required to send Gupshup template messages')
        }

        const body = new URLSearchParams()
        body.append('channel', GUPSHUP_CHANNEL)
        body.append('source', this.globalVendorArgs.phoneNumber)
        body.append('destination', to)

        if (this.globalVendorArgs.srcName) {
            body.append('src.name', this.globalVendorArgs.srcName)
        }

        body.append('template', JSON.stringify(template))

        if (message) {
            body.append('message', JSON.stringify(message))
        }

        if (postbackTexts?.length) {
            body.append('postbackTexts', JSON.stringify(postbackTexts))
        }

        try {
            const response = await this.http.post('/template/msg', body)
            return response.data
        } catch (error) {
            this.emitOutboundErrorNotice(to, 'template', error)
            throw error
        }
    }

    public markAsRead = async (msgId: string, appId = this.globalVendorArgs.appId): Promise<any> => {
        if (!appId) {
            throw new Error('appId is required to mark messages as read')
        }

        const response = await axios.put(
            `${APP_BASE_URL}/${encodeURIComponent(appId)}/msg/${encodeURIComponent(msgId)}/read`,
            null,
            {
                headers: {
                    apikey: this.globalVendorArgs.apiKey,
                },
            }
        )

        return response.data
    }

    public getMessageStatus = async (msgId: string, appId = this.globalVendorArgs.appId): Promise<any> => {
        if (!appId) {
            throw new Error('appId is required to fetch message status')
        }

        const response = await axios.get(
            `${APP_BASE_URL}/${encodeURIComponent(appId)}/msg/${encodeURIComponent(msgId)}`,
            {
                headers: {
                    apikey: this.globalVendorArgs.apiKey,
                },
            }
        )

        return response.data
    }
}
