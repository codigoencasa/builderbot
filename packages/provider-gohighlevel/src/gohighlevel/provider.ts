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
import { ContactResolver } from '../utils/contactResolver'
import { downloadFile } from '../utils/downloadFile'
import { parseGHLNumber } from '../utils/number'
import { TokenManager } from '../utils/tokenManager'

import type { GoHighLevelInterface } from '~/interface/gohighlevel'
import type { GHLGlobalVendorArgs, GHLMessage, GHLSendMessageBody, SaveFileOptions } from '~/types'

const GHL_API_URL = 'https://services.leadconnectorhq.com'

class GoHighLevelProvider extends ProviderClass<GoHighLevelInterface> implements GoHighLevelInterface {
    public vendor: Vendor<any>
    public queue: Queue = new Queue()
    public tokenManager: TokenManager
    public contactResolver: ContactResolver

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

        // Forward ContactResolver errors to provider notice events
        this.contactResolver.on('error', (payload) => {
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
            const token = await this.tokenManager.getValidToken()
            if (!token) {
                const authUrl = this.getAuthorizationUrl()
                this.emit('notice', {
                    title: 'GHL AUTHORIZATION REQUIRED',
                    instructions: [
                        `Visit this URL to authorize: ${authUrl}`,
                        'https://builderbot.app/en/providers/gohighlevel',
                    ],
                })
                this.emit('require_action', {
                    title: 'Authorization Required',
                    instructions: ['GoHighLevel requires OAuth2 authorization.', `Visit: ${authUrl}`],
                })
                return
            }

            const host = {
                locationId: this.globalVendorArgs.locationId,
                channelType: this.globalVendorArgs.channelType,
            }
            this.vendor.emit('host', host)
            this.emit('ready')
        } catch (err) {
            this.emit('notice', {
                title: 'GHL AUTH ERROR',
                instructions: [err.message || 'Check credentials'],
            })
            this.emit('error', err)
        }
    }

    protected initVendor(): Promise<any> {
        const vendor = new GoHighLevelCoreVendor(this.queue, this.tokenManager, this.globalVendorArgs.webhookSecret)
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
        })

        this.vendor = vendor
        return Promise.resolve(this.vendor)
    }

    public async stop(): Promise<void> {
        this.tokenManager.destroy()
        this.contactResolver.clearCache()
        await super.stop()
    }

    public getAuthorizationUrl(): string {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.globalVendorArgs.clientId,
            redirect_uri: this.globalVendorArgs.redirectUri || '',
            scope: 'conversations.message.readonly conversations.message.write contacts.readonly contacts.write',
        })
        return `https://marketplace.gohighlevel.com/oauth/chooselocation?${params.toString()}`
    }

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
            func: () => this.emit('ready', true),
        },
        {
            event: 'message',
            func: (payload: BotContext) => {
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

    resolveContactId = async (phone: string): Promise<string | null> => {
        const token = await this.tokenManager.getValidToken()
        return this.contactResolver.resolveContactId(parseGHLNumber(phone), this.globalVendorArgs.locationId, token)
    }

    sendText = async (to: string, message: string): Promise<any> => {
        const contactId = await this.resolveContactId(to)
        if (!contactId) throw new Error(`Contact not found for phone: ${to}`)

        const body: GHLSendMessageBody = {
            type: this.globalVendorArgs.channelType,
            contactId,
            message,
        }

        if (this.globalVendorArgs.conversationProviderId) {
            body.conversationProviderId = this.globalVendorArgs.conversationProviderId
        }

        return this.sendMessageGHL(body)
    }

    sendMedia = async (to: string, text: string = '', mediaInput: string): Promise<any> => {
        const contactId = await this.resolveContactId(to)
        if (!contactId) throw new Error(`Contact not found for phone: ${to}`)

        const fileDownloaded = await utils.generalDownload(mediaInput)
        const mimeType = mime.lookup(fileDownloaded)

        if (mimeType && mimeType.includes('audio')) {
            const fileConverted = await utils.convertAudio(fileDownloaded, 'mp3')
            mediaInput = fileConverted
        } else {
            mediaInput = fileDownloaded
        }

        const body: GHLSendMessageBody = {
            type: this.globalVendorArgs.channelType,
            contactId,
            message: text,
            attachments: [mediaInput],
        }

        if (this.globalVendorArgs.conversationProviderId) {
            body.conversationProviderId = this.globalVendorArgs.conversationProviderId
        }

        return this.sendMessageGHL(body)
    }

    sendButtons = async (to: string, buttons: Button[] = [], text: string): Promise<any> => {
        const buttonText = buttons.map((btn, i) => `${i + 1}. ${btn.body}`).join('\n')
        const fullMessage = `${text}\n\n${buttonText}`
        return this.sendText(to, fullMessage)
    }

    sendMessage = async (to: string, message: string, options?: SendOptions): Promise<any> => {
        to = parseGHLNumber(to)
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
