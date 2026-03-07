import { ProviderClass } from '@builderbot/bot'
import type { BotContext, GlobalVendorArgs, SendOptions } from '@builderbot/bot/dist/types'
import axios from 'axios'
import crypto from 'crypto'
import { writeFile } from 'fs/promises'
import mime from 'mime-types'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import type { Middleware } from 'polka'
import { TwitterApi } from 'twitter-api-v2'

import { TwitterEvents } from './twitter.events'

export type TwitterArgs = GlobalVendorArgs & {
    /** OAuth 1.0a API Key (Consumer Key) */
    appKey: string
    /** OAuth 1.0a API Secret (Consumer Secret) */
    appSecret: string
    /** OAuth 1.0a Access Token */
    accessToken: string
    /** OAuth 1.0a Access Token Secret */
    accessSecret: string
    /**
     * Twitter Account Activity API environment name.
     * Defaults to 'production'. Configure it in the Twitter Developer Portal.
     */
    webhookEnv?: string
}

/**
 * A class representing a TwitterProvider for interacting with Twitter/X API.
 * Supports receiving Direct Messages and Mentions via webhooks (Account Activity API),
 * and sending DMs and tweet replies.
 *
 * @requires Twitter Developer Account with Basic tier or higher for Account Activity API
 * @extends ProviderClass
 */
class TwitterProvider extends ProviderClass<TwitterEvents> {
    globalVendorArgs: TwitterArgs = {
        name: 'twitter-bot',
        port: 3000,
        appKey: undefined,
        appSecret: undefined,
        accessToken: undefined,
        accessSecret: undefined,
        webhookEnv: 'production',
    }

    private twitterClient: TwitterApi
    private botUserId: string

    constructor(args?: TwitterArgs) {
        super()
        this.globalVendorArgs = { ...this.globalVendorArgs, ...args }

        if (!this.globalVendorArgs.appKey) {
            throw new Error('Must provide Twitter App Key (API Key)')
        }
        if (!this.globalVendorArgs.appSecret) {
            throw new Error('Must provide Twitter App Secret (API Secret)')
        }
        if (!this.globalVendorArgs.accessToken) {
            throw new Error('Must provide Twitter Access Token')
        }
        if (!this.globalVendorArgs.accessSecret) {
            throw new Error('Must provide Twitter Access Token Secret')
        }
    }

    protected async initVendor(): Promise<any> {
        const vendor = new TwitterEvents()
        this.vendor = vendor

        this.twitterClient = new TwitterApi({
            appKey: this.globalVendorArgs.appKey,
            appSecret: this.globalVendorArgs.appSecret,
            accessToken: this.globalVendorArgs.accessToken,
            accessSecret: this.globalVendorArgs.accessSecret,
        })

        this.server = this.server.post('/webhook', this.ctrlInMsg).get('/webhook', this.ctrlVerify)

        await this.checkStatus()
        return vendor
    }

    protected beforeHttpServerInit(): void {}

    protected afterHttpServerInit(): void {}

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

    /**
     * Verifies the bot's credentials and retrieves the bot's user ID.
     */
    async checkStatus(): Promise<void> {
        try {
            const me = await this.twitterClient.v2.me()
            this.botUserId = me.data.id
            console.info(`[Twitter] Authenticated as @${me.data.username} (${me.data.id})`)
            this.emit('ready', true)
        } catch (err) {
            console.error('[Twitter] Error checking status:', { error: err.message })
            this.emit('auth_failure', {
                title: '❌ TWITTER CONNECTION FAILED ❌',
                instructions: [
                    'Failed to authenticate with Twitter API',
                    'Please check your App Key, App Secret, Access Token and Access Token Secret',
                    'Make sure your app has Read and Write + Direct Messages permissions',
                ],
                payload: { qr: 'no_need_qr' },
            })
        }
    }

    /**
     * Handles Twitter's CRC (Challenge Response Check) webhook verification.
     * Twitter sends a GET request with a crc_token; we respond with an HMAC-SHA256 hash.
     */
    protected ctrlVerify: Middleware = (req, res) => {
        const crcToken = req.query['crc_token']

        if (!crcToken) {
            res.writeHead(400)
            return res.end(JSON.stringify({ error: 'crc_token missing' }))
        }

        const hmac = crypto
            .createHmac('sha256', this.globalVendorArgs.appSecret)
            .update(crcToken as string)
            .digest('base64')

        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ response_token: `sha256=${hmac}` }))
    }

    /**
     * Handles incoming webhook events (DMs and mentions) from Twitter.
     */
    protected ctrlInMsg: Middleware = (req, res) => {
        this.vendor.eventInMsg(req.body)
        return res.end('EVENT_RECEIVED')
    }

    /**
     * Sends a Direct Message to a user.
     * If mediaURL is provided in options, the media is uploaded and attached.
     */
    sendMessage = async (userId: string, message: string, options?: SendOptions): Promise<any> => {
        try {
            if (options?.mediaURL) {
                return await this.sendMediaDM(userId, message, options.mediaURL)
            }

            const response = await this.twitterClient.v2.sendDmToParticipant(userId, { text: message })
            console.info('[Twitter] DM sent successfully')
            return response
        } catch (error) {
            console.error('[Twitter] Error sending message:', { error: error.message })
            throw new Error('Failed to send Twitter DM')
        }
    }

    /**
     * Sends a Direct Message with a media attachment.
     * @param userId - The recipient's Twitter user ID
     * @param message - Text to accompany the media
     * @param mediaUrl - Publicly accessible URL of the media
     */
    async sendMediaDM(userId: string, message: string, mediaUrl: string): Promise<any> {
        try {
            const mediaResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' })
            const mediaBuffer = Buffer.from(mediaResponse.data)
            const contentType = mediaResponse.headers['content-type']
            const mimeType = (contentType?.split(';')[0] || 'image/jpeg') as string

            const mediaId = await this.twitterClient.v1.uploadMedia(mediaBuffer, { mimeType })

            const response = await this.twitterClient.v2.sendDmToParticipant(userId, {
                text: message,
                attachments: [{ media_id: mediaId }],
            })

            console.info('[Twitter] Media DM sent successfully')
            return response
        } catch (error) {
            console.error('[Twitter] Error sending media DM:', { error: error.message })
            throw new Error('Failed to send Twitter media DM')
        }
    }

    /**
     * Replies to a tweet (for handling @mention interactions).
     * @param tweetId - The ID of the tweet to reply to
     * @param message - The reply text
     */
    async replyToTweet(tweetId: string, message: string): Promise<any> {
        try {
            const response = await this.twitterClient.v2.reply(message, tweetId)
            console.info('[Twitter] Tweet reply sent successfully')
            return response
        } catch (error) {
            console.error('[Twitter] Error replying to tweet:', { error: error.message })
            throw new Error('Failed to reply to tweet')
        }
    }

    /**
     * Downloads and saves a media file from a received message context.
     * @param ctx - The bot context containing media information
     * @param options - Optional path where the file should be saved
     * @returns The path to the saved file, or empty string if no media
     */
    saveFile = async (ctx: Partial<BotContext>, options?: { path: string }): Promise<string> => {
        if (!ctx?.data?.media?.url) return ''
        try {
            const response = await axios.get(ctx.data.media.url, { responseType: 'arraybuffer' })
            const contentType = response.headers['content-type']
            const ext = mime.extension(contentType) || 'bin'
            const fileName = `file-${Date.now()}.${ext}`
            const pathFile = join(options?.path ?? tmpdir(), fileName)
            await writeFile(pathFile, response.data)
            return resolve(pathFile)
        } catch (err) {
            console.error('[Twitter] Error saving file:', { error: err.message })
            return 'ERROR'
        }
    }
}

export { TwitterProvider }
