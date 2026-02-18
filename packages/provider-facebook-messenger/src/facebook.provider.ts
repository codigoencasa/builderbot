import { ProviderClass } from '@builderbot/bot'
import type { BotContext, GlobalVendorArgs, SendOptions } from '@builderbot/bot/dist/types'
import axios, { AxiosResponse } from 'axios'
import { writeFile } from 'fs/promises'
import mime from 'mime-types'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import type { Middleware } from 'polka'

import { MessengerEvents } from './facebook.events'

const MESSENGER_API_URL = 'https://graph.facebook.com/'

export type FacebookMessengerArgs = GlobalVendorArgs & {
    accessToken: string
    pageId: string
    version?: string
    verifyToken: string
}

/**
 * A class representing a FacebookMessengerProvider for interacting with Facebook Messenger API.
 * @extends ProviderClass
 */
class FacebookMessengerProvider extends ProviderClass<MessengerEvents> {
    globalVendorArgs: FacebookMessengerArgs = {
        name: 'facebook-messenger-bot',
        port: 3000,
        accessToken: undefined,
        pageId: undefined,
        version: 'v19.0',
        verifyToken: undefined,
    }

    constructor(args?: FacebookMessengerArgs) {
        super()
        this.globalVendorArgs = { ...this.globalVendorArgs, ...args }

        if (!this.globalVendorArgs.accessToken) {
            throw new Error('Must provide Facebook Page Access Token')
        }
        if (!this.globalVendorArgs.pageId) {
            throw new Error('Must provide Facebook Page ID')
        }
        if (!this.globalVendorArgs.verifyToken) {
            throw new Error('Must provide Messenger Verify Token')
        }
    }

    protected async initVendor(): Promise<any> {
        const vendor = new MessengerEvents()
        this.vendor = vendor
        this.server = this.server.post('/webhook', this.ctrlInMsg).get('/webhook', this.ctrlVerify)

        await this.checkStatus()
        return vendor
    }

    protected beforeHttpServerInit(): void {}

    protected afterHttpServerInit(): void {}

    /**
     * Event handlers for bus events.
     */
    busEvents = () => [
        {
            event: 'auth_failure',
            func: (payload: any) => this.emit('auth_failure', payload),
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
    ]

    private async downloadFile(mediaUrl: string): Promise<{ buffer: Buffer; extension: string }> {
        try {
            const response: AxiosResponse = await axios.get(mediaUrl, {
                headers: {
                    Authorization: `Bearer ${this.globalVendorArgs.accessToken}`,
                },
                responseType: 'arraybuffer',
            })
            const contentType = response.headers['content-type']
            const ext = mime.extension(contentType)
            if (!ext) throw new Error('Unable to determine file extension')
            return {
                buffer: response.data,
                extension: ext,
            }
        } catch (error) {
            console.error('[FacebookMessenger] Error downloading file', { error: error.message })
            throw error
        }
    }

    protected ctrlInMsg: Middleware = (req, res) => {
        this.vendor.eventInMsg(req.body)
        return res.end('EVENT_RECEIVED')
    }

    protected ctrlVerify: Middleware = (req, res) => {
        const mode = req.query['hub.mode']
        const token = req.query['hub.verify_token']
        const challenge = req.query['hub.challenge']

        if (mode && token) {
            if (mode === 'subscribe' && token === this.globalVendorArgs.verifyToken) {
                console.info('[FacebookMessenger] Webhook verified')
                return res.end(challenge)
            } else {
                return res.end('ERROR')
            }
        }
        return res.end('ERROR')
    }

    async checkStatus(): Promise<void> {
        try {
            const response = await axios.get(
                `https://graph.facebook.com/${this.globalVendorArgs.version}/me?access_token=${this.globalVendorArgs.accessToken}`
            )
            if (response.status === 200) {
                console.info('[FacebookMessenger] Successfully authenticated with Facebook Messenger API')
                this.emit('ready', true)
            } else {
                console.error('[FacebookMessenger] Unexpected response status:', { status: response.status })
                throw new Error(`Unexpected response status: ${response.status}`)
            }
        } catch (err) {
            if (axios.isAxiosError(err)) {
                console.error('[FacebookMessenger] Error checking status:', {
                    error: err.response?.data || err.message,
                })
            } else {
                console.error('[FacebookMessenger] Unknown error checking status:', { error: err })
            }
            this.emit('auth_failure', {
                title: '❌ CONNECTION FAILED ❌',
                instructions: ['Failed to authenticate with Facebook API', 'Please check your access token'],
                payload: { qr: 'no_need_qr' },
            })
        }
    }

    sendMessage = async (userId: string, message: string, _options?: SendOptions): Promise<any> => {
        const url = `${MESSENGER_API_URL}${this.globalVendorArgs.version}/me/messages`
        try {
            const body = {
                recipient: { id: userId },
                message: { text: message },
                access_token: this.globalVendorArgs.accessToken,
            }

            const response = await axios.post(url, body)
            console.info('[FacebookMessenger] Message sent successfully')
            return response.data
        } catch (error) {
            console.error('[FacebookMessenger] Error sending message:', {
                error: error.response?.data || error.message,
            })
            throw new Error('Failed to send message')
        }
    }

    /**
     * Send an image attachment to a user
     */
    async sendImage(userId: string, imageUrl: string): Promise<any> {
        const url = `${MESSENGER_API_URL}${this.globalVendorArgs.version}/me/messages`
        try {
            const body = {
                recipient: { id: userId },
                message: {
                    attachment: {
                        type: 'image',
                        payload: {
                            url: imageUrl,
                            is_reusable: true,
                        },
                    },
                },
                access_token: this.globalVendorArgs.accessToken,
            }

            const response = await axios.post(url, body)
            console.info('[FacebookMessenger] Image sent successfully')
            return response.data
        } catch (error) {
            console.error('[FacebookMessenger] Error sending image:', { error: error.response?.data || error.message })
            throw new Error('Failed to send image')
        }
    }

    /**
     * Send a video attachment to a user
     */
    async sendVideo(userId: string, videoUrl: string): Promise<any> {
        const url = `${MESSENGER_API_URL}${this.globalVendorArgs.version}/me/messages`
        try {
            const body = {
                recipient: { id: userId },
                message: {
                    attachment: {
                        type: 'video',
                        payload: {
                            url: videoUrl,
                            is_reusable: true,
                        },
                    },
                },
                access_token: this.globalVendorArgs.accessToken,
            }

            const response = await axios.post(url, body)
            console.info('[FacebookMessenger] Video sent successfully')
            return response.data
        } catch (error) {
            console.error('[FacebookMessenger] Error sending video:', { error: error.response?.data || error.message })
            throw new Error('Failed to send video')
        }
    }

    /**
     * Send an audio attachment to a user
     */
    async sendAudio(userId: string, audioUrl: string): Promise<any> {
        const url = `${MESSENGER_API_URL}${this.globalVendorArgs.version}/me/messages`
        try {
            const body = {
                recipient: { id: userId },
                message: {
                    attachment: {
                        type: 'audio',
                        payload: {
                            url: audioUrl,
                            is_reusable: true,
                        },
                    },
                },
                access_token: this.globalVendorArgs.accessToken,
            }

            const response = await axios.post(url, body)
            console.info('[FacebookMessenger] Audio sent successfully')
            return response.data
        } catch (error) {
            console.error('[FacebookMessenger] Error sending audio:', { error: error.response?.data || error.message })
            throw new Error('Failed to send audio')
        }
    }

    /**
     * Send a file attachment to a user
     */
    async sendFile(userId: string, fileUrl: string): Promise<any> {
        const url = `${MESSENGER_API_URL}${this.globalVendorArgs.version}/me/messages`
        try {
            const body = {
                recipient: { id: userId },
                message: {
                    attachment: {
                        type: 'file',
                        payload: {
                            url: fileUrl,
                            is_reusable: true,
                        },
                    },
                },
                access_token: this.globalVendorArgs.accessToken,
            }

            const response = await axios.post(url, body)
            console.info('[FacebookMessenger] File sent successfully')
            return response.data
        } catch (error) {
            console.error('[FacebookMessenger] Error sending file:', { error: error.response?.data || error.message })
            throw new Error('Failed to send file')
        }
    }

    /**
     * Send buttons to a user
     */
    async sendButtons(
        userId: string,
        text: string,
        buttons: Array<{ type: string; title: string; payload?: string; url?: string }>
    ): Promise<any> {
        const url = `${MESSENGER_API_URL}${this.globalVendorArgs.version}/me/messages`
        try {
            const body = {
                recipient: { id: userId },
                message: {
                    attachment: {
                        type: 'template',
                        payload: {
                            template_type: 'button',
                            text: text,
                            buttons: buttons.map((btn) => ({
                                type: btn.type || 'postback',
                                title: btn.title,
                                payload: btn.payload,
                                url: btn.url,
                            })),
                        },
                    },
                },
                access_token: this.globalVendorArgs.accessToken,
            }

            const response = await axios.post(url, body)
            console.info('[FacebookMessenger] Buttons sent successfully')
            return response.data
        } catch (error) {
            console.error('[FacebookMessenger] Error sending buttons:', {
                error: error.response?.data || error.message,
            })
            throw new Error('Failed to send buttons')
        }
    }

    /**
     * Send quick replies to a user
     */
    async sendQuickReplies(
        userId: string,
        text: string,
        quickReplies: Array<{ content_type: string; title: string; payload: string }>
    ): Promise<any> {
        const url = `${MESSENGER_API_URL}${this.globalVendorArgs.version}/me/messages`
        try {
            const body = {
                recipient: { id: userId },
                message: {
                    text: text,
                    quick_replies: quickReplies,
                },
                access_token: this.globalVendorArgs.accessToken,
            }

            const response = await axios.post(url, body)
            console.info('[FacebookMessenger] Quick replies sent successfully')
            return response.data
        } catch (error) {
            console.error('[FacebookMessenger] Error sending quick replies:', {
                error: error.response?.data || error.message,
            })
            throw new Error('Failed to send quick replies')
        }
    }

    /**
     * Save a file from a received message context
     * @param ctx - The bot context containing media information
     * @param options - Options for saving the file
     * @returns The path to the saved file
     */
    saveFile = async (ctx: Partial<BotContext>, options?: { path: string }): Promise<string> => {
        if (!ctx?.data?.media?.url) return ''
        try {
            const { buffer, extension } = await this.downloadFile(ctx.data.media.url)
            const fileName = `file-${Date.now()}.${extension}`
            const pathFile = join(options?.path ?? tmpdir(), fileName)
            await writeFile(pathFile, buffer)
            return resolve(pathFile)
        } catch (err) {
            console.error('[FacebookMessenger] Error saving file:', { error: err.message })
            return 'ERROR'
        }
    }
}

export { FacebookMessengerProvider }
