/**
 * LAYER: Infrastructure
 * Contains: AxiosError, AxiosResponse
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [AxiosError, AxiosResponse]
 * GOAL: Own the "provider" concern of the provider-evolution-api package.
 */
import { ProviderClass } from '@builderbot/bot'
import type { Vendor } from '@builderbot/bot/dist/provider/interface/provider'
import type { BotContext, SendOptions } from '@builderbot/bot/dist/types'
import { json } from '@polka/parse'
import axios, { AxiosError, AxiosResponse } from 'axios'
import fs, { createReadStream } from 'fs'
import { writeFile } from 'fs/promises'
import mime from 'mime-types'
import { tmpdir } from 'os'
import path, { join, resolve } from 'path'
import { Middleware } from 'polka'
import type polka from 'polka'
import Queue from 'queue-promise'

import type { EvolutionInterface } from '../interface/evolution'
import type {
    EvolutionGlobalVendorArgs,
    SaveFileOptions,
    MediaMessage,
    TextMessage,
    ApiResponse,
    MediaType,
} from '../types'
import { generalDownload } from '../utils'
import { EvolutionCoreVendor } from './core'

// Maximum file size in bytes (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024
// Default timeout for API requests in ms
const DEFAULT_TIMEOUT = 30000

/**
 * Evolution API Provider implementation
 * Handles all communication with Evolution API for sending messages, media, etc.
 */
class EvolutionProvider extends ProviderClass<EvolutionInterface> implements EvolutionInterface {
    public vendor: Vendor<
        EvolutionInterface & {
            indexHome: polka.Middleware
            incomingMsg: polka.Middleware
        }
    >
    public queue: Queue = new Queue()
    public incomingMsg: (req: any, res: any) => void | Promise<void>

    public globalVendorArgs: EvolutionGlobalVendorArgs = {
        name: 'bot',
        apiKey: '',
        baseURL: 'http://localhost:8080',
        instanceName: '',
        port: 3000,
    }

    /**
     * Creates an instance of Evolution Provider
     * @param args Provider configuration
     * @throws Error if required configuration is missing
     */
    constructor(args: EvolutionGlobalVendorArgs) {
        super()

        // Validate required parameters
        if (!args.apiKey) {
            throw new Error('API Key is required')
        }
        if (!args.instanceName) {
            throw new Error('Instance name is required')
        }

        this.globalVendorArgs = { ...this.globalVendorArgs, ...args }
        this.queue = new Queue({
            concurrent: 1,
            interval: 100,
            start: true,
        })
    }

    sendMessageMeta: <K = ApiResponse>(body: any) => Promise<K>
    sendImageUrl: (to: string, url: string, mediaName?: string, caption?: string) => Promise<ApiResponse>
    sendVideoUrl: (to: string, url: string, mediaName?: string, caption?: string) => Promise<ApiResponse>
    sendAudioUrl: (to: string, url: string, mediaName?: string, caption?: string) => Promise<ApiResponse>
    sendList: (to: string, list: any) => Promise<ApiResponse>
    sendListComplete: (to: string, list: any) => Promise<ApiResponse>
    indexHome?: Middleware<any, any, any, any>

    /**
     * Initialize HTTP server middleware
     */
    protected beforeHttpServerInit(): void {
        this.server = this.server
            .use(json({ limit: '50mb' }))
            .use((req, _, next) => {
                req['globalVendorArgs'] = this.globalVendorArgs
                return next()
            })
            .post('/', this.vendor.indexHome)
            .post('/webhook', this.vendor.incomingMsg)
    }

    /**
     * Initialize vendor core
     * @returns Promise resolving to the vendor instance
     */
    protected initVendor(): Promise<any> {
        const vendor = new EvolutionCoreVendor(this.queue)
        this.vendor = vendor as unknown as Vendor<
            EvolutionInterface & { indexHome: polka.Middleware; incomingMsg: polka.Middleware }
        >
        return Promise.resolve(this.vendor)
    }

    /**
     * Build standard headers for API requests
     * @param additionalHeaders Optional additional headers to include
     * @returns Headers object with apiKey
     */
    private builderHeader(additionalHeaders: Record<string, string> = {}): Record<string, string> {
        const { apiKey } = this.globalVendorArgs
        return {
            apikey: apiKey,
            'Content-Type': 'application/json',
            ...additionalHeaders,
        }
    }

    /**
     * Verify connection with Evolution API after HTTP server initialization
     * @throws Error if connection fails
     */
    protected async afterHttpServerInit(): Promise<void> {
        try {
            const { baseURL, instanceName } = this.globalVendorArgs

            // Verify connection with Evolution API
            const response = await axios.get(`${baseURL}/instance/connectionState/${instanceName}`, {
                headers: this.builderHeader(),
                timeout: DEFAULT_TIMEOUT,
            })

            const state = response.data?.state ?? response.data?.instance?.state ?? 'close'
            if (state === 'open') {
                this.emit('ready')
            } else {
                throw new Error(`Instance state: ${state}`)
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error'
            this.emit('notice', {
                title: '🟠 ERROR AUTH 🟠',
                instructions: [
                    'Error connecting to Evolution API, please check your credentials',
                    'Make sure your instance is connected',
                    `Details: ${errorMessage}`,
                ],
            })
        }
    }

    /**
     * Event bus configuration
     * @returns Array of event handlers
     */
    protected busEvents() {
        return [
            {
                event: 'auth_failure',
                func: (payload: unknown) => this.emit('auth_failure', payload),
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
        ]
    }

    /**
     * Entry point for sending media files.
     * Detects file type and routes to appropriate function.
     *
     * @param to Destination phone number
     * @param file URL or path to media file
     * @param type Optional media type description (unused but required by interface)
     * @returns Promise resolving to API response
     * @throws Error if file type cannot be determined or exceeds size limit
     */
    sendMedia = async (to: string, file: string, type: string): Promise<ApiResponse> => {
        try {
            const fileDownloaded = await generalDownload(file)

            // Check file size
            const stats = fs.statSync(fileDownloaded)
            if (stats.size > MAX_FILE_SIZE) {
                throw new Error(`File size exceeds limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`)
            }

            const mimeType = mime.lookup(fileDownloaded)

            if (!mimeType) throw new Error('Could not determine MIME type')

            if (mimeType.includes('image')) {
                return this.sendImage(to, fileDownloaded, type || '')
            }

            if (mimeType.includes('video')) {
                return this.sendVideo(to, fileDownloaded, type || '')
            }

            if (mimeType.includes('audio')) {
                return this.sendAudio(to, fileDownloaded)
            }

            return this.sendFile(to, fileDownloaded, type || '')
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error sending media'
            console.error('Error sending media:', errorMessage)
            throw new Error(`Failed to send media: ${errorMessage}`)
        }
    }

    /**
     * Convert file to base64 with size validation
     * @param filePath Path to file
     * @returns Base64 encoded file content
     * @throws Error if file is too large
     */
    private async fileToBase64(filePath: string): Promise<string> {
        const stats = fs.statSync(filePath)
        if (stats.size > MAX_FILE_SIZE) {
            throw new Error(`File size exceeds limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`)
        }
        return fs.readFileSync(filePath, { encoding: 'base64' })
    }

    /**
     * Prepare media message body
     * @param number Destination number
     * @param filePath Media file path
     * @param mediaType Type of media
     * @param caption Optional caption
     * @returns Prepared message body
     */
    private async prepareMediaMessageBody(
        number: string,
        filePath: string,
        mediaType: MediaType,
        caption?: string
    ): Promise<MediaMessage> {
        const mediaBase64 = await this.fileToBase64(filePath)
        const mimeType = mime.lookup(filePath) || 'application/octet-stream'
        const fileName = path.basename(filePath)

        const body: MediaMessage = {
            number,
            media: mediaBase64,
            mimetype: mimeType,
            mediatype: mediaType,
            caption: caption || fileName,
            delay: 0,
        }

        if (mediaType === 'document') {
            body.fileName = fileName
        }

        return body
    }

    /**
     * Send an image to the given number
     * @param number Destination number
     * @param filePath Local path to image
     * @param caption Optional text caption
     * @returns Promise resolving to API response
     */
    sendImage = async (number: string, filePath: string, caption: string): Promise<ApiResponse> => {
        try {
            const body = await this.prepareMediaMessageBody(number, filePath, 'image', caption)
            return this.sendMessageEvoApi(body, '/message/sendMedia/')
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error sending image'
            console.error('Error sending image:', errorMessage)
            throw new Error(`Failed to send image: ${errorMessage}`)
        }
    }

    /**
     * Send a video to the given number
     * @param to Destination number
     * @param mediaUrl Local path to video
     * @param caption Optional text caption
     * @returns Promise resolving to API response
     */
    sendVideo = async (to: string, mediaUrl: string, caption?: string): Promise<ApiResponse> => {
        try {
            const fileDownloaded = mediaUrl.startsWith('http') ? await generalDownload(mediaUrl) : mediaUrl

            const body = await this.prepareMediaMessageBody(to, fileDownloaded, 'video', caption)
            return this.sendMessageEvoApi(body, '/message/sendMedia/')
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error sending video'
            console.error('Error sending video:', errorMessage)
            throw new Error(`Failed to send video: ${errorMessage}`)
        }
    }

    /**
     * Send an audio file in compatible format (OPUS)
     * @param to Destination number
     * @param mediaUrl Local path to audio file
     * @param mediaName Optional media name (unused but required by interface)
     * @param caption Optional caption (unused for audio)
     * @returns Promise resolving to API response
     */
    sendAudio = async (to: string, mediaUrl: string, mediaName?: string, caption?: string): Promise<ApiResponse> => {
        try {
            const fileDownloaded = mediaUrl.startsWith('http') ? await generalDownload(mediaUrl) : mediaUrl

            const mediaBase64 = await this.fileToBase64(fileDownloaded)

            const body: MediaMessage = {
                number: to,
                media: mediaBase64,
                mimetype: 'audio/ogg; codecs=opus',
                mediatype: 'audio',
                delay: 0,
            }

            return this.sendMessageEvoApi(body, '/message/sendMedia/')
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error sending audio'
            console.error('Error sending audio:', errorMessage)
            throw new Error(`Failed to send audio: ${errorMessage}`)
        }
    }

    /**
     * Send a generic document to the given number
     * @param number Destination number
     * @param filePath Local path to the file
     * @param caption Optional text caption
     * @returns Promise resolving to API response
     */
    sendFile = async (number: string, filePath: string, caption: string): Promise<ApiResponse> => {
        try {
            const body = await this.prepareMediaMessageBody(number, filePath, 'document', caption)
            return this.sendMessageEvoApi(body, '/message/sendMedia/')
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error sending file'
            console.error('Error sending file:', errorMessage)
            throw new Error(`Failed to send file: ${errorMessage}`)
        }
    }

    /**
     * Send a plain text message
     * @param number Destination number
     * @param message Message content
     * @returns Promise resolving to API response
     */
    sendText = async (number: string, message: string): Promise<ApiResponse> => {
        try {
            const endpoint = '/message/sendText/'

            const body: TextMessage = {
                number,
                text: message,
                delay: 0,
            }

            return this.sendMessageEvoApi(body, endpoint)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error sending text'
            console.error('Error sending text:', errorMessage)
            throw new Error(`Failed to send text: ${errorMessage}`)
        }
    }

    /**
     * General function for making POST requests to external API
     * @param body Request body
     * @param endpoint Relative endpoint path (optional)
     * @returns Promise resolving to API response
     * @throws Error if request fails
     */
    sendMessageToApi = async <K = ApiResponse>(body: any, endpoint: string = '/message/'): Promise<K> => {
        const { baseURL, instanceName, apiKey } = this.globalVendorArgs
        const url = `${baseURL}${endpoint}${instanceName}`

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: this.builderHeader(),
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
            })

            if (!response.ok) {
                throw new Error(`Error sending message: ${response.statusText}`)
            }

            const data = await response.json()
            return data as K
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error in API request'
            console.error(`API request failed (${endpoint}):`, message)
            throw new Error(`API request failed: ${message}`)
        }
    }

    /**
     * Queue a message send to ensure order and avoid conflicts
     * @param body Message body
     * @param endpoint API endpoint
     * @returns Promise resolving to API response
     */
    sendMessageEvoApi = <K = ApiResponse>(body: any, endpoint: string): Promise<K> => {
        return new Promise<K>((resolve, reject) =>
            this.queue.add(async () => {
                try {
                    const resp = await this.sendMessageToApi<K>(body, endpoint)
                    resolve(resp)
                } catch (error) {
                    reject(error)
                }
            })
        )
    }

    /**
     * General router for sending messages.
     * If it includes media, it's sent as a file. If not, as plain text.
     *
     * @param to Destination number
     * @param message Text message
     * @param args Additional options (media, etc.)
     * @returns Promise resolving to API response
     */
    async sendMessage<K = ApiResponse>(to: string, message: string, args?: any): Promise<K> {
        try {
            // Sanitize phone number (remove non-numeric chars except +)
            const sanitizedNumber = to.replace(/[^\d+]/g, '')

            // Process options
            const options = args as SendOptions
            const mergedOptions = { ...options, ...options?.['options'] }

            let response: ApiResponse
            if (mergedOptions?.media) {
                response = await this.sendMedia(sanitizedNumber, mergedOptions.media, mergedOptions.type || '')
            } else {
                response = await this.sendText(sanitizedNumber, message)
            }

            return response as unknown as K
        } catch (error) {
            console.error('Error in sendMessage:', error)
            throw error
        }
    }

    /**
     * Save a file from context
     * @param ctx Partial bot context
     * @param options Save options
     * @returns Promise resolving to the file path
     * @throws Error if file cannot be saved
     */
    saveFile = async (ctx: Partial<BotContext>, options: SaveFileOptions = {}): Promise<string> => {
        try {
            if (!ctx.base64) {
                throw new Error('No base64 data provided')
            }

            const buffer = ctx.base64
            const extension = mime.extension(ctx.mimetype ?? 'application/octet-stream') as string
            const fileName = `file-${Date.now()}.${extension}`
            const pathFile = join(options?.path ?? tmpdir(), fileName)

            await writeFile(pathFile, buffer)
            return resolve(pathFile)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error saving file'
            console.error('Error saving file:', errorMessage)
            return Promise.reject(new Error(`Failed to save file: ${errorMessage}`))
        }
    }
}

export { EvolutionProvider }
