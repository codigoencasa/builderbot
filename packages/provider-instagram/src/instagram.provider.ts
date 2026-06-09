import { ProviderClass, utils } from '@builderbot/bot'
import type { BotContext, GlobalVendorArgs, SendOptions } from '@builderbot/bot/dist/types'
import axios, { AxiosResponse } from 'axios'
import FormData from 'form-data'
import { createReadStream, existsSync } from 'fs'
import { writeFile } from 'fs/promises'
import mime from 'mime-types'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import type { Middleware } from 'polka'

import { InstagramEvents, InstagramListenMode } from './instagram.events'

const INSTAGRAM_API_URL = 'https://graph.instagram.com/'
const FACEBOOK_GRAPH_API_URL = 'https://graph.facebook.com/'

export type InstagramArgs = GlobalVendorArgs & {
    accessToken: string
    igAccountId: string
    version?: string
    verifyToken: string
    listenMode?: InstagramListenMode
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

/**
 * A class representing an InstagramProvider for interacting with Instagram Messaging API.
 * @extends ProviderClass
 */
class InstagramProvider extends ProviderClass<InstagramEvents> {
    globalVendorArgs: InstagramArgs = {
        name: 'instagram-bot',
        port: 3000,
        accessToken: undefined,
        igAccountId: undefined,
        version: 'v19.0',
        verifyToken: undefined,
        listenMode: 'message',
    }

    /**
     * Tracks the most recent comment.id per userId so that the first outbound
     * message after a comment event is routed via Private Replies
     * (recipient: { comment_id }) instead of a regular DM (recipient: { id }).
     * Only the last comment per user is kept; entries older than 7 days are
     * purged automatically to avoid memory leaks.
     */
    private pendingComments = new Map<string, { commentId: string; timestamp: number }>()

    constructor(args?: InstagramArgs) {
        super()
        this.globalVendorArgs = { ...this.globalVendorArgs, ...args }

        if (!this.globalVendorArgs.accessToken) {
            throw new Error('Must provide Instagram Access Token')
        }
        if (!this.globalVendorArgs.igAccountId) {
            throw new Error('Must provide Instagram Account ID')
        }
        if (!this.globalVendorArgs.verifyToken) {
            throw new Error('Must provide Instagram Verify Token')
        }
    }

    protected async initVendor(): Promise<any> {
        const vendor = new InstagramEvents()
        vendor.setListenMode(this.globalVendorArgs.listenMode || 'message')
        this.vendor = vendor
        this.server = this.server.post('/webhook', this.ctrlInMsg).get('/webhook', this.ctrlVerify)

        vendor.on('message', (payload: any) => {
            if (payload?.comment?.id && payload?.from) {
                this.pendingComments.set(payload.from, {
                    commentId: payload.comment.id,
                    timestamp: Date.now(),
                })
            }
        })

        const cleanupInterval = setInterval(
            () => {
                const cutoff = Date.now() - SEVEN_DAYS_MS
                for (const [userId, entry] of this.pendingComments) {
                    if (entry.timestamp < cutoff) this.pendingComments.delete(userId)
                }
            },
            60 * 60 * 1000
        )
        cleanupInterval.unref()

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
            console.error('[Instagram] Error downloading file', { error: error.message })
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
                console.info('[Instagram] Webhook verified')
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
                `https://graph.instagram.com/${this.globalVendorArgs.version}/me?fields=id,username&access_token=${this.globalVendorArgs.accessToken}`
            )
            if (response.status === 200) {
                console.info('[Instagram] Successfully authenticated with Instagram API')
                this.emit('ready', true)
            } else {
                console.error('[Instagram] Unexpected response status:', { status: response.status })
                throw new Error(`Unexpected response status: ${response.status}`)
            }
        } catch (err) {
            if (axios.isAxiosError(err)) {
                console.error('[Instagram] Error checking status:', {
                    error: err.response?.data || err.message,
                })
            } else {
                console.error('[Instagram] Unknown error checking status:', { error: err })
            }
            this.emit('auth_failure', {
                title: '❌ CONNECTION FAILED ❌',
                instructions: ['Failed to authenticate with Instagram API', 'Please check your access token'],
                payload: { qr: 'no_need_qr' },
            })
        }
    }

    /**
     * Send a media file (image, video, or audio) to a user.
     * Automatically detects the media type and calls the appropriate method.
     * @param userId - The recipient user ID
     * @param text - Optional text message (not used for Instagram media, logged as info)
     * @param mediaInput - URL or local file path of the media
     * @returns Promise with the API response
     */
    sendMedia = async (userId: string, text: string, mediaInput: string): Promise<any> => {
        try {
            // Download/process the media file
            const fileDownloaded = await utils.generalDownload(mediaInput)
            const mimeType = mime.lookup(fileDownloaded) || ''

            if (text) {
                console.info('[Instagram] Note: Instagram does not support captions with media attachments')
            }

            // Determine media type and send accordingly
            if (mimeType.includes('image')) {
                return this.sendImageFromFile(userId, fileDownloaded)
            }
            if (mimeType.includes('video')) {
                return this.sendVideoFromFile(userId, fileDownloaded)
            }
            if (mimeType.includes('audio')) {
                return this.sendAudioFromFile(userId, fileDownloaded)
            }

            // Instagram does NOT support file/document attachments
            console.warn(
                '[Instagram] File type not supported (Instagram only supports image, video, audio). Sending text only.',
                { mimeType }
            )
            if (text) {
                return this.sendText(userId, text)
            }
            return { warning: 'Unsupported file type, no message sent' }
        } catch (error) {
            console.error('[Instagram] Error sending media:', { error: error.message })
            throw new Error('Failed to send media')
        }
    }

    /**
     * Send a text message to a user
     * @param userId - The recipient user ID
     * @param message - The text message to send
     * @returns Promise with the API response
     */
    sendText = async (userId: string, message: string): Promise<any> => {
        const url = `${INSTAGRAM_API_URL}${this.globalVendorArgs.version}/${this.globalVendorArgs.igAccountId}/messages`
        try {
            const body = {
                recipient: { id: userId },
                message: { text: message },
                access_token: this.globalVendorArgs.accessToken,
            }

            const response = await axios.post(url, body)
            console.info('[Instagram] Message sent successfully')
            return response.data
        } catch (error) {
            const igError = error.response?.data?.error
            if (igError?.error_subcode === 2534022 || igError?.code === 10) {
                console.warn('[Instagram] 24h window closed, skipping message to:', userId)
                this.emit('window_expired', { userId, message })
                return null
            }
            console.error('[Instagram] Error sending message:', { error: igError || error.message })
            throw new Error('Failed to send message')
        }
    }

    sendMessage = async (userId: string, message: string, options?: SendOptions): Promise<any> => {
        if (options?.comment?.id) {
            return this.sendPrivateReply(options.comment.id, message)
        }

        const pending = this.pendingComments.get(userId)
        if (pending) {
            this.pendingComments.delete(userId)
            return this.sendPrivateReply(pending.commentId, message)
        }

        if (options?.media) {
            return this.sendMedia(userId, message, options.media)
        }
        return this.sendText(userId, message)
    }

    /**
     * Upload an attachment (image, video, audio) to Instagram servers.
     * Returns an attachment_id that can be used to send the attachment.
     * @param filePath - Local path to the file
     * @param type - Type of attachment: 'image', 'video', or 'audio'
     * @returns Promise with the attachment_id
     */
    private uploadAttachment = async (filePath: string, type: 'image' | 'video' | 'audio'): Promise<string> => {
        const url = `${INSTAGRAM_API_URL}${this.globalVendorArgs.version}/${this.globalVendorArgs.igAccountId}/message_attachments`

        if (!existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`)
        }

        try {
            const formData = new FormData()
            const mimeType = mime.lookup(filePath) || 'application/octet-stream'

            formData.append('message', JSON.stringify({ attachment: { type, payload: { is_reusable: true } } }))
            formData.append('filedata', createReadStream(filePath), {
                contentType: mimeType,
            })

            const response = await axios.post(url, formData, {
                headers: {
                    ...formData.getHeaders(),
                    Authorization: `Bearer ${this.globalVendorArgs.accessToken}`,
                },
                params: {
                    access_token: this.globalVendorArgs.accessToken,
                },
            })

            console.info('[Instagram] Attachment uploaded successfully')
            return response.data.attachment_id
        } catch (error) {
            console.error('[Instagram] Error uploading attachment:', {
                error: error.response?.data || error.message,
            })
            throw new Error('Failed to upload attachment')
        }
    }

    /**
     * Send an attachment using a previously uploaded attachment_id
     * @param userId - The recipient user ID
     * @param attachmentId - The attachment_id from uploadAttachment
     * @returns Promise with the API response
     */
    private sendAttachmentById = async (userId: string, attachmentId: string): Promise<any> => {
        const url = `${INSTAGRAM_API_URL}${this.globalVendorArgs.version}/${this.globalVendorArgs.igAccountId}/messages`
        try {
            const body = {
                recipient: { id: userId },
                message: {
                    attachment: {
                        type: 'image',
                        payload: {
                            attachment_id: attachmentId,
                        },
                    },
                },
                access_token: this.globalVendorArgs.accessToken,
            }

            const response = await axios.post(url, body)
            console.info('[Instagram] Attachment sent successfully')
            return response.data
        } catch (error) {
            const igError = error.response?.data?.error
            if (igError?.error_subcode === 2534022 || igError?.code === 10) {
                console.warn('[Instagram] 24h window closed, skipping attachment to:', userId)
                this.emit('window_expired', { userId })
                return null
            }
            console.error('[Instagram] Error sending attachment:', { error: igError || error.message })
            throw new Error('Failed to send attachment')
        }
    }

    /**
     * Send an image from a local file path
     * @param userId - The recipient user ID
     * @param filePath - Local path to the image file
     * @returns Promise with the API response
     */
    sendImageFromFile = async (userId: string, filePath: string): Promise<any> => {
        const attachmentId = await this.uploadAttachment(filePath, 'image')
        return this.sendAttachmentById(userId, attachmentId)
    }

    /**
     * Send a video from a local file path
     * @param userId - The recipient user ID
     * @param filePath - Local path to the video file
     * @returns Promise with the API response
     */
    sendVideoFromFile = async (userId: string, filePath: string): Promise<any> => {
        const attachmentId = await this.uploadAttachment(filePath, 'video')
        return this.sendAttachmentById(userId, attachmentId)
    }

    /**
     * Send an audio from a local file path
     * @param userId - The recipient user ID
     * @param filePath - Local path to the audio file
     * @returns Promise with the API response
     */
    sendAudioFromFile = async (userId: string, filePath: string): Promise<any> => {
        const attachmentId = await this.uploadAttachment(filePath, 'audio')
        return this.sendAttachmentById(userId, attachmentId)
    }

    /**
     * Send an image attachment to a user (from URL)
     */
    async sendImage(userId: string, imageUrl: string): Promise<any> {
        const url = `${INSTAGRAM_API_URL}${this.globalVendorArgs.version}/${this.globalVendorArgs.igAccountId}/messages`
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
            console.info('[Instagram] Image sent successfully')
            return response.data
        } catch (error) {
            const igError = error.response?.data?.error
            if (igError?.error_subcode === 2534022 || igError?.code === 10) {
                console.warn('[Instagram] 24h window closed, skipping image to:', userId)
                this.emit('window_expired', { userId })
                return null
            }
            console.error('[Instagram] Error sending image:', { error: igError || error.message })
            throw new Error('Failed to send image')
        }
    }

    /**
     * Send a video attachment to a user
     */
    async sendVideo(userId: string, videoUrl: string): Promise<any> {
        const url = `${INSTAGRAM_API_URL}${this.globalVendorArgs.version}/${this.globalVendorArgs.igAccountId}/messages`
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
            console.info('[Instagram] Video sent successfully')
            return response.data
        } catch (error) {
            const igError = error.response?.data?.error
            if (igError?.error_subcode === 2534022 || igError?.code === 10) {
                console.warn('[Instagram] 24h window closed, skipping video to:', userId)
                this.emit('window_expired', { userId })
                return null
            }
            console.error('[Instagram] Error sending video:', { error: igError || error.message })
            throw new Error('Failed to send video')
        }
    }

    /**
     * Send an audio attachment to a user
     */
    async sendAudio(userId: string, audioUrl: string): Promise<any> {
        const url = `${INSTAGRAM_API_URL}${this.globalVendorArgs.version}/${this.globalVendorArgs.igAccountId}/messages`
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
            console.info('[Instagram] Audio sent successfully')
            return response.data
        } catch (error) {
            const igError = error.response?.data?.error
            if (igError?.error_subcode === 2534022 || igError?.code === 10) {
                console.warn('[Instagram] 24h window closed, skipping audio to:', userId)
                this.emit('window_expired', { userId })
                return null
            }
            console.error('[Instagram] Error sending audio:', { error: igError || error.message })
            throw new Error('Failed to send audio')
        }
    }

    /**
     * Send a file attachment to a user
     */
    async sendFile(userId: string, fileUrl: string): Promise<any> {
        const url = `${INSTAGRAM_API_URL}${this.globalVendorArgs.version}/${this.globalVendorArgs.igAccountId}/messages`
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
            console.info('[Instagram] File sent successfully')
            return response.data
        } catch (error) {
            const igError = error.response?.data?.error
            if (igError?.error_subcode === 2534022 || igError?.code === 10) {
                console.warn('[Instagram] 24h window closed, skipping file to:', userId)
                this.emit('window_expired', { userId })
                return null
            }
            console.error('[Instagram] Error sending file:', { error: igError || error.message })
            throw new Error('Failed to send file')
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
        const url = `${INSTAGRAM_API_URL}${this.globalVendorArgs.version}/${this.globalVendorArgs.igAccountId}/messages`
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
            console.info('[Instagram] Quick replies sent successfully')
            return response.data
        } catch (error) {
            const igError = error.response?.data?.error
            if (igError?.error_subcode === 2534022 || igError?.code === 10) {
                console.warn('[Instagram] 24h window closed, skipping quick replies to:', userId)
                this.emit('window_expired', { userId, message: text })
                return null
            }
            console.error('[Instagram] Error sending quick replies:', { error: igError || error.message })
            throw new Error('Failed to send quick replies')
        }
    }

    /**
     * Reply to a comment on a media post (public reply visible on the post)
     * Uses the Facebook Graph API endpoint: POST /{comment-id}/replies
     * @param commentId - The ID of the comment to reply to
     * @param message - The reply text
     */
    replyComment = async (commentId: string, message: string): Promise<any> => {
        const url = `${FACEBOOK_GRAPH_API_URL}${this.globalVendorArgs.version}/${commentId}/replies`
        try {
            const body = {
                message,
                access_token: this.globalVendorArgs.accessToken,
            }
            const response = await axios.post(url, body)
            console.info('[Instagram] Comment reply sent successfully')
            return response.data
        } catch (error) {
            console.error('[Instagram] Error replying to comment:', {
                error: error.response?.data || error.message,
            })
            throw new Error('Failed to reply to comment')
        }
    }

    /**
     * Send a private reply (DM) to a user who commented on your post.
     * Uses Instagram Private Replies: recipient is identified by comment_id.
     * The DM goes to the user's inbox (or Message Requests if they don't follow you).
     * Note: This does NOT open a full conversation window — an additional
     * message from the user is required to open one.
     * @param commentId - The ID of the comment to privately reply to
     * @param message - The message text to send via DM
     */
    sendPrivateReply = async (commentId: string, message: string): Promise<any> => {
        const url = `${INSTAGRAM_API_URL}${this.globalVendorArgs.version}/me/messages`
        try {
            const body = {
                recipient: { comment_id: commentId },
                message: { text: message },
                access_token: this.globalVendorArgs.accessToken,
            }
            const response = await axios.post(url, body)
            console.info('[Instagram] Private reply sent successfully')
            return response.data
        } catch (error) {
            const igError = error.response?.data?.error
            if (igError?.error_subcode === 2534022 || igError?.code === 10) {
                console.warn('[Instagram] Comment window expired, skipping private reply to comment:', commentId)
                return null
            }
            console.error('[Instagram] Error sending private reply:', {
                error: igError || error.message,
            })
            throw new Error('Failed to send private reply')
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
            console.error('[Instagram] Error saving file:', { error: err.message })
            return 'ERROR'
        }
    }
}

export { InstagramProvider }
