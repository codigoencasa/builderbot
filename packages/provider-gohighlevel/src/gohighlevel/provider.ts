/**
 * LAYER: Infrastructure
 * Contains: GoHighLevelCoreVendor, ChannelLister
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(n) score:3
 * keywords: [GoHighLevelCoreVendor, ChannelLister]
 * GOAL: Own the "provider" concern of the provider-gohighlevel package.
 */
import { ProviderClass, utils } from '@builderbot/bot'
import type { Vendor } from '@builderbot/bot/dist/provider/interface/provider'
import type { BotContext, Button, SendOptions } from '@builderbot/bot/dist/types'
import axios from 'axios'
import { writeFile } from 'fs/promises'
import mime from 'mime-types'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import Queue from 'queue-promise'

import { GoHighLevelCoreVendor } from './core'
import { ChannelLister } from '../utils/channelLister'
import { ContactResolver } from '../utils/contactResolver'
import { downloadFile } from '../utils/downloadFile'
import { parseGHLNumber } from '../utils/number'
import { TokenManager } from '../utils/tokenManager'

import type { GoHighLevelInterface } from '~/interface/gohighlevel'
import type { GHLChannelType, GHLGlobalVendorArgs, GHLMessage, GHLSendMessageBody, SaveFileOptions } from '~/types'

const GHL_API_URL = 'https://services.leadconnectorhq.com'

/**
 * GoHighLevel Provider for BuilderBot
 * @description Integrates with GoHighLevel CRM to send/receive messages via SMS, WhatsApp, Email, etc.
 * @see https://builderbot.app/en/providers/gohighlevel
 * @example
 * ```typescript
 * const provider = createProvider(GoHighLevelProvider, {
 *   clientId: 'YOUR_CLIENT_ID',
 *   clientSecret: 'YOUR_CLIENT_SECRET',
 *   locationId: 'YOUR_LOCATION_ID',
 *   channelType: 'WhatsApp',
 *   accessToken: 'OPTIONAL_TOKEN',
 *   refreshToken: 'OPTIONAL_REFRESH_TOKEN',
 * })
 * ```
 */
class GoHighLevelProvider extends ProviderClass<GoHighLevelInterface> implements GoHighLevelInterface {
    public vendor: Vendor<any>
    public queue: Queue = new Queue()
    public tokenManager: TokenManager
    public contactResolver: ContactResolver
    public channelLister: ChannelLister
    private isReady: boolean = false
    /** Cache to store the channel type per contactId for auto-reply on same channel */
    private contactChannelCache: Map<string, GHLChannelType> = new Map()

    public globalVendorArgs: GHLGlobalVendorArgs = {
        name: 'bot',
        clientId: '',
        clientSecret: '',
        locationId: '',
        channelType: 'SMS',
        apiVersion: '2021-07-28',
        port: 3000,
        writeMyself: 'none',
    }

    /**
     * Creates a new GoHighLevel provider instance
     * @param args - Configuration options for the provider
     * @throws Error if clientId, clientSecret, or locationId are missing
     */
    constructor(args: GHLGlobalVendorArgs) {
        super()
        this.globalVendorArgs = { ...this.globalVendorArgs, ...args }

        if (!this.globalVendorArgs.clientId || !this.globalVendorArgs.clientSecret) {
            throw new Error('[GoHighLevel] clientId and clientSecret are required')
        }
        if (!this.globalVendorArgs.locationId) {
            throw new Error('[GoHighLevel] locationId is required')
        }

        this.queue = new Queue({
            concurrent: 1,
            interval: 100,
            start: true,
        })
        this.tokenManager = new TokenManager(
            this.globalVendorArgs.clientId,
            this.globalVendorArgs.clientSecret,
            this.globalVendorArgs.redirectUri
        )
        this.contactResolver = new ContactResolver(this.globalVendorArgs.apiVersion)
        this.channelLister = new ChannelLister(this.globalVendorArgs.apiVersion)

        // Forward ContactResolver errors to provider notice events
        this.contactResolver.on('error', (payload) => {
            this.emit('notice', payload)
        })

        // Forward ChannelLister errors to provider notice events
        this.channelLister.on('error', (payload) => {
            this.emit('notice', payload)
        })

        if (this.globalVendorArgs.accessToken) {
            this.tokenManager.setTokens({
                access_token: this.globalVendorArgs.accessToken,
                refresh_token: this.globalVendorArgs.refreshToken,
                expires_in: 86400,
            })
        }
    }

    protected beforeHttpServerInit(): void {
        // Routes are registered in initVendor() to avoid duplicates
    }

    protected async afterHttpServerInit(): Promise<void> {
        try {
            // If tokens are configured, validate them
            if (this.globalVendorArgs.accessToken) {
                this.emit('notice', {
                    title: '🔄 Validating existing token...',
                    instructions: [],
                })

                const isValid = await this.tokenManager.validateToken()

                if (isValid) {
                    await this.emitReadyNotice()
                    return
                }

                // Token invalid, try refresh if available
                if (this.globalVendorArgs.refreshToken) {
                    try {
                        this.emit('notice', {
                            title: '🔄 Token expired, refreshing...',
                            instructions: [],
                        })
                        const newTokens = await this.tokenManager.refreshAccessToken()
                        this.emitTokensNotice(newTokens)
                        await this.emitReadyNotice()
                        return
                    } catch (refreshErr) {
                        // Refresh failed, fall through to show OAuth URL
                    }
                }

                // All failed, show error
                this.emit('notice', {
                    title: '❌ Tokens invalid',
                    instructions: [
                        'The tokens in your config are no longer valid.',
                        'Please re-authorize using the URL below.',
                    ],
                })
            }

            // No tokens or validation failed - show OAuth URL
            this.showAuthorizationUrl()
        } catch (err: any) {
            this.emit('notice', {
                title: '❌ GHL Auth Error',
                instructions: [err.message || 'Check credentials'],
            })
            this.emit('error', err)
        }
    }

    private showAuthorizationUrl(): void {
        const authUrl = this.getAuthorizationUrl()
        this.emit('notice', {
            title: '🔐 GHL Authorization Required',
            instructions: [
                '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
                'Visit this URL to authorize your app:',
                '',
                authUrl,
                '',
                'Docs: https://builderbot.app/en/providers/gohighlevel',
                '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            ],
        })
    }

    private emitTokensNotice(tokens: { access_token: string; refresh_token: string }): void {
        this.emit('notice', {
            title: '🔑 New OAuth Tokens - Copy to your config:',
            instructions: [
                '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
                `accessToken: '${tokens.access_token}',`,
                `refreshToken: '${tokens.refresh_token}',`,
                '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            ],
        })
    }

    private async emitReadyNotice(): Promise<void> {
        if (this.isReady) return

        this.isReady = true
        const host = {
            locationId: this.globalVendorArgs.locationId,
            channelType: this.globalVendorArgs.channelType,
        }
        this.vendor.emit('host', host)
        this.emit('notice', {
            title: '✅ GHL Connected',
            instructions: [
                '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
                `Location ID: ${this.globalVendorArgs.locationId}`,
                `Channel: ${this.globalVendorArgs.channelType}`,
                'Bot is ready to receive messages!',
                '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            ],
        })

        // List available channels based on channel type
        await this.listAvailableChannels()

        this.emit('ready')
    }

    private async listAvailableChannels(): Promise<void> {
        try {
            const token = await this.tokenManager.getValidToken()
            if (!token) return

            const channels = await this.channelLister.listByChannelType(
                this.globalVendorArgs.channelType,
                this.globalVendorArgs.locationId,
                token
            )

            if (channels.length === 0) return

            const channelType = this.globalVendorArgs.channelType
            const isPhone = channelType === 'SMS' || channelType === 'WhatsApp'
            const title = isPhone ? '📱 Available Phone Numbers:' : '📧 Available Email Accounts:'

            const instructions = [
                '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
                ...channels.map((c) => (c.name ? `  ${c.name}: ${c.value}` : `  ${c.value}`)),
                '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            ]

            this.emit('notice', { title, instructions })
        } catch (error) {
            // Don't block bot startup if channel listing fails
        }
    }

    protected initVendor(): Promise<any> {
        const vendor = new GoHighLevelCoreVendor(this.queue, this.tokenManager, this.globalVendorArgs.webhookSecret)

        // NOTE: Event listeners are registered by ProviderClass.listenOnEvents()
        // Do NOT register them here to avoid duplicates

        this.server = this.server
            .use((req, _, next) => {
                req['globalVendorArgs'] = this.globalVendorArgs
                return next()
            })
            .get('/', vendor.indexHome)
            .get('/oauth/callback', vendor.oauthCallback)
            .post('/webhook', vendor.incomingMsg)

        this.tokenManager.on('tokens_updated', (tokens) => {
            this.globalVendorArgs.accessToken = tokens.access_token
            this.globalVendorArgs.refreshToken = tokens.refresh_token
            this.emit('tokens_updated', tokens)
            // If bot is already running, this is an automatic refresh - show new tokens
            if (this.isReady) {
                this.emitTokensNotice(tokens)
            }
        })

        this.vendor = vendor
        return Promise.resolve(this.vendor)
    }

    /** Stops the provider and cleans up resources */
    public async stop(): Promise<void> {
        this.tokenManager.destroy()
        this.contactResolver.clearCache()
        await super.stop()
    }

    /** Returns the OAuth authorization URL for GoHighLevel */
    public getAuthorizationUrl(): string {
        const params = new URLSearchParams({
            response_type: 'code',
            redirect_uri: this.globalVendorArgs.redirectUri || '',
            client_id: this.globalVendorArgs.clientId,
            scope: 'conversations.readonly conversations.write conversations/message.readonly conversations/message.write',
        })
        if (this.globalVendorArgs.versionId) {
            params.append('version_id', this.globalVendorArgs.versionId)
        }
        return `https://marketplace.gohighlevel.com/oauth/chooselocation?${params.toString()}`
    }

    /**
     * Downloads and saves a file from an incoming message
     * @param ctx - Message context containing file URL
     * @param options - Save options (path)
     * @returns Path to saved file or 'ERROR'
     */
    saveFile = async (ctx: Partial<GHLMessage & BotContext>, options: SaveFileOptions = {}): Promise<string> => {
        try {
            const url = ctx?.url ?? ctx?.attachments?.[0]?.url
            if (!url) throw new Error('No file URL found in context')
            const token = await this.tokenManager.getValidToken()
            const { buffer, extension } = await downloadFile(url, token)
            const fileName = `file-${Date.now()}.${extension}`
            const pathFile = join(options?.path ?? tmpdir(), fileName)
            await writeFile(pathFile, buffer)
            return resolve(pathFile)
        } catch (err) {
            this.emit('notice', {
                title: 'GHL SAVE FILE ERROR',
                instructions: [`Failed to save file: ${err.message}`],
            })
            return 'ERROR'
        }
    }

    busEvents = () => [
        {
            event: 'auth_failure',
            func: (payload: any) => this.emit('auth_failure', payload),
        },
        {
            event: 'notice',
            func: ({ instructions, title }: { instructions: string[]; title: string }) =>
                this.emit('notice', { instructions, title }),
        },
        {
            event: 'ready',
            func: () => {
                if (!this.isReady) {
                    this.isReady = true
                    this.emit('ready', true)
                }
            },
        },
        {
            event: 'message',
            func: (payload: BotContext) => {
                // Cache the channel type for this contact to auto-reply on same channel
                const msg = payload as unknown as GHLMessage
                if (msg.contactId && msg.channelType) {
                    this.contactChannelCache.set(msg.contactId, msg.channelType)
                }
                this.emit('message', payload)
            },
        },
        {
            event: 'host',
            func: (payload: any) => {
                this.emit('host', payload)
            },
        },
        {
            event: 'tokens_updated',
            func: (payload: any) => {
                this.globalVendorArgs.accessToken = payload.access_token
                this.globalVendorArgs.refreshToken = payload.refresh_token
            },
        },
    ]

    /**
     * Resolves a phone number to a GHL contact ID
     * @param phone - Phone number to resolve
     * @returns Contact ID or null if not found
     */
    resolveContactId = async (phone: string): Promise<string | null> => {
        const token = await this.tokenManager.getValidToken()
        return this.contactResolver.resolveContactId(parseGHLNumber(phone), this.globalVendorArgs.locationId, token)
    }

    /**
     * Checks if a string looks like a GHL contactId rather than a phone number
     * ContactIds are alphanumeric strings, while phones are mostly digits
     * @param value - String to check
     * @returns true if the value appears to be a contactId
     */
    private isContactId(value: string): boolean {
        if (!value || value.length === 0) return false
        // Phone numbers are mostly digits (with optional + prefix, spaces, dashes)
        // ContactIds are alphanumeric strings like '8ctXFfVOgXyBgJ4fAqox'
        return !/^\+?\d[\d\s-]*$/.test(value)
    }

    /**
     * Gets the channel type to use for a contact
     * Returns the cached channel (from last incoming message) or falls back to global config
     * @param contactId - The contact ID to look up
     * @returns The channel type to use for sending messages
     */
    private getChannelForContact(contactId: string): GHLChannelType {
        return this.contactChannelCache.get(contactId) || this.globalVendorArgs.channelType
    }

    /**
     * Sends a text message to a contact
     * @param to - Recipient phone number or contactId
     * @param message - Text message content
     */
    sendText = async (to: string, message: string): Promise<any> => {
        // Debug logs
        console.log('[GHL DEBUG] sendText called with to:', to)
        console.log('[GHL DEBUG] isContactId(to):', this.isContactId(to))

        // If 'to' is already a contactId, use it directly; otherwise resolve from phone
        const contactId = this.isContactId(to) ? to : await this.resolveContactId(to)
        console.log('[GHL DEBUG] resolved contactId:', contactId)

        if (!contactId) throw new Error(`Contact not found for: ${to}`)

        const body: GHLSendMessageBody = {
            type: this.getChannelForContact(contactId),
            contactId,
            message,
        }

        if (this.globalVendorArgs.conversationProviderId) {
            body.conversationProviderId = this.globalVendorArgs.conversationProviderId
        }

        return this.sendMessageGHL(body)
    }

    /**
     * Sends a media message (image, audio, video, document)
     * @param to - Recipient phone number or contactId
     * @param text - Optional caption text
     * @param mediaInput - URL or path to media file
     */
    sendMedia = async (to: string, text: string = '', mediaInput: string): Promise<any> => {
        // If 'to' is already a contactId, use it directly; otherwise resolve from phone
        const contactId = this.isContactId(to) ? to : await this.resolveContactId(to)
        if (!contactId) throw new Error(`Contact not found for: ${to}`)

        const fileDownloaded = await utils.generalDownload(mediaInput)
        const mimeType = mime.lookup(fileDownloaded)

        if (mimeType && mimeType.includes('audio')) {
            const fileConverted = await utils.convertAudio(fileDownloaded, 'mp3')
            mediaInput = fileConverted
        } else {
            mediaInput = fileDownloaded
        }

        const body: GHLSendMessageBody = {
            type: this.getChannelForContact(contactId),
            contactId,
            message: text,
            attachments: [mediaInput],
        }

        if (this.globalVendorArgs.conversationProviderId) {
            body.conversationProviderId = this.globalVendorArgs.conversationProviderId
        }

        return this.sendMessageGHL(body)
    }

    /**
     * Sends a message with buttons (rendered as numbered list)
     * @param to - Recipient phone number
     * @param buttons - Array of button objects
     * @param text - Message text
     */
    sendButtons = async (to: string, buttons: Button[] = [], text: string): Promise<any> => {
        const buttonText = buttons.map((btn, i) => `${i + 1}. ${btn.body}`).join('\n')
        const fullMessage = `${text}\n\n${buttonText}`
        return this.sendText(to, fullMessage)
    }

    /**
     * Sends a message with optional media or buttons
     * @param to - Recipient phone number or contactId
     * @param message - Message text
     * @param options - Optional send options (media, buttons)
     */
    sendMessage = async (to: string, message: string, options?: SendOptions): Promise<any> => {
        // Only parse phone numbers, not contactIds (contactIds contain letters)
        if (!this.isContactId(to)) {
            to = parseGHLNumber(to)
        }
        options = { ...options, ...options?.['options'] }
        if (options?.buttons?.length) return this.sendButtons(to, options.buttons, message)
        if (options?.media) return this.sendMedia(to, message, options.media)
        return this.sendText(to, message)
    }

    sendMessageGHL = (body: GHLSendMessageBody): Promise<any> => {
        return new Promise((resolve, reject) =>
            this.queue.add(async () => {
                try {
                    const resp = await this.sendMessageToApi(body)
                    resolve(resp)
                } catch (error) {
                    reject(error)
                }
            })
        )
    }

    sendMessageToApi = async (body: GHLSendMessageBody): Promise<any> => {
        const token = await this.tokenManager.getValidToken()
        const response = await axios.post(`${GHL_API_URL}/conversations/messages`, body, {
            headers: {
                Authorization: `Bearer ${token}`,
                Version: this.globalVendorArgs.apiVersion,
                'Content-Type': 'application/json',
            },
        })
        return response.data
    }
}

export { GoHighLevelProvider }
