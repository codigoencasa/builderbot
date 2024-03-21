import { ProviderClass, utils } from '@builderbot/bot'
import { Vendor } from '@builderbot/bot/dist/provider/providerClass'
import { BotContext, BotCtxMiddleware, BotCtxMiddlewareOptions, Button, SendOptions } from '@builderbot/bot/dist/types'
import axios from 'axios'
import FormData from 'form-data'
import { createReadStream } from 'fs'
import { writeFile } from 'fs/promises'
import mime from 'mime-types'
import { tmpdir } from 'os'
import { join, basename } from 'path'
import Queue from 'queue-promise'

import { MetaInterface } from './metaInterface'
import { MetaWebHookServer } from './server'
import {
    GlobalVendorArgs,
    Localization,
    Message,
    MetaList,
    MetaProviderOptions,
    ParsedContact,
    Reaction,
    SaveFileOptions,
    TextGenericParams,
    TextMessageBody,
} from './types'
import { downloadFile } from './utils'
import { parseMetaNumber } from './utils/number'

const URL = `https://graph.facebook.com`

class MetaProvider extends ProviderClass implements MetaInterface {
    http: MetaWebHookServer | undefined
    queue: Queue = new Queue()
    vendor: Vendor<MetaInterface>
    globalVendorArgs: MetaProviderOptions & Partial<GlobalVendorArgs> = {
        name: 'bot',
        jwtToken: undefined,
        numberId: undefined,
        verifyToken: undefined,
        version: 'v18.0',
    }

    constructor(args: MetaProviderOptions & Partial<GlobalVendorArgs>) {
        super()

        this.globalVendorArgs = { ...this.globalVendorArgs, ...args }
        this.http = new MetaWebHookServer(
            this.globalVendorArgs.jwtToken,
            this.globalVendorArgs.numberId,
            this.globalVendorArgs.version,
            this.globalVendorArgs.verifyToken,
            args.port
        )

        this.queue = new Queue({
            concurrent: 1,
            interval: 100,
            start: true,
        })
    }

    /**
     *
     * @param ctx
     * @param options
     * @returns
     */
    saveFile = async (ctx: Partial<Message & BotContext>, options: SaveFileOptions = {}): Promise<string> => {
        try {
            const { buffer, extension } = await downloadFile(ctx?.url, this.globalVendorArgs.jwtToken)
            const fileName = `file-${Date.now()}.${extension}`
            const pathFile = join(options?.path ?? tmpdir(), fileName)
            await writeFile(pathFile, buffer)
            return pathFile
        } catch (err) {
            console.log(`[Error]:`, err.message)
            return 'ERROR'
        }
    }

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

    private listenOnEvents = () => {
        const listEvents = this.busEvents()
        for (const { event, func } of listEvents) {
            this.http.on(event, func)
        }
    }

    initHttpServer = (port: number, opts: Pick<BotCtxMiddlewareOptions, 'blacklist'>) => {
        const methods: BotCtxMiddleware<MetaProvider> = {
            sendMessage: this.sendMessage,
            provider: this,
            blacklist: opts.blacklist,
            dispatch: (customEvent, payload) => {
                this.emit('message', {
                    ...payload,
                    body: utils.setEvent(customEvent),
                    name: payload.name,
                    from: utils.removePlus(payload.from),
                })
            },
        }
        this.http.start(methods, port, { botName: this.globalVendorArgs.name }, (routes) => {
            this.emit('notice', {
                title: '🛜  HTTP Server ON ',
                instructions: routes,
            })

            this.emit('notice', {
                title: '⚡⚡ SETUP META/FACEBOOK ⚡⚡',
                instructions: [
                    `Add "Webhook" URL`,
                    `http://localhost:${port}/webhook`,
                    `More info https://builderbot.vercel.app/en/providers/meta`,
                ],
            })
        })
        this.listenOnEvents()
        return
    }

    sendImage = async (to: string, mediaInput = null) => {
        to = parseMetaNumber(to)
        if (!mediaInput) throw new Error(`MEDIA_INPUT_NULL_: ${mediaInput}`)

        const formData = new FormData()
        const mimeType = mime.lookup(mediaInput)
        formData.append('file', createReadStream(mediaInput), {
            contentType: mimeType,
        })
        formData.append('messaging_product', 'whatsapp')

        const {
            data: { id: mediaId },
        } = await axios.post(
            `${URL}/${this.globalVendorArgs.version}/${this.globalVendorArgs.numberId}/media`,
            formData,
            {
                headers: {
                    Authorization: `Bearer ${this.globalVendorArgs.jwtToken}`,
                    ...formData.getHeaders(),
                },
            }
        )

        const body: TextMessageBody = {
            messaging_product: 'whatsapp',
            to,
            type: 'image',
            image: {
                id: mediaId,
            },
        }
        return this.sendMessageMeta(body)
    }

    sendVideo = async (to: string, pathVideo = null) => {
        to = parseMetaNumber(to)
        if (!pathVideo) throw new Error(`MEDIA_INPUT_NULL_: ${pathVideo}`)

        const formData = new FormData()
        const mimeType = mime.lookup(pathVideo)
        formData.append('file', createReadStream(pathVideo), {
            contentType: mimeType,
        })
        formData.append('messaging_product', 'whatsapp')
        const {
            data: { id: mediaId },
        } = await axios.post(
            `${URL}/${this.globalVendorArgs.version}/${this.globalVendorArgs.numberId}/media`,
            formData,
            {
                headers: {
                    Authorization: `Bearer ${this.globalVendorArgs.jwtToken}`,
                    ...formData.getHeaders(),
                },
            }
        )

        const body = {
            messaging_product: 'whatsapp',
            to,
            type: 'video',
            video: {
                id: mediaId,
            },
        }
        return this.sendMessageMeta(body)
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    sendMedia = async (to: string, _ = '', mediaInput: string) => {
        to = parseMetaNumber(to)
        const fileDownloaded = await utils.generalDownload(mediaInput)
        const mimeType = mime.lookup(fileDownloaded)
        mediaInput = fileDownloaded
        if (mimeType.includes('image')) return this.sendImage(to, mediaInput)
        if (mimeType.includes('video')) return this.sendVideo(to, fileDownloaded)
        if (mimeType.includes('audio')) {
            const fileOpus = await utils.convertAudio(mediaInput, 'mp3')
            return this.sendAudio(to, fileOpus)
        }

        return this.sendFile(to, mediaInput)
    }

    sendList = async (to: string, list: MetaList) => {
        to = parseMetaNumber(to)
        const parseList = { ...list, ...{ type: 'list' } }
        const body: TextMessageBody = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'interactive',
            interactive: parseList,
        }
        return this.sendMessageMeta(body)
    }

    sendButtons = async (to: string, buttons: Button[] = [], text: string) => {
        to = parseMetaNumber(to)
        const parseButtons = buttons.map((btn, i) => ({
            type: 'reply',
            reply: {
                id: `btn-${i}`,
                title: btn.body.slice(0, 15),
            },
        }))

        const body: TextMessageBody = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: {
                    text,
                },
                action: {
                    buttons: parseButtons,
                },
            },
        }
        return this.sendMessageMeta(body)
    }

    sendButtonUrl = async (to: string, button: Button & { url: string }, text: string): Promise<any> => {
        to = parseMetaNumber(to)
        const body: TextMessageBody = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'interactive',
            interactive: {
                type: 'cta_url',
                body: {
                    text,
                },
                action: {
                    name: 'cta_url',
                    parameters: {
                        display_text: button.body.slice(0, 15),
                        url: button.url,
                    },
                },
            },
        }
        return this.sendMessageMeta(body)
    }

    sendTemplate = async (to: string, template: TextGenericParams) => {
        to = parseMetaNumber(to)
        const body: TextGenericParams = { ...template }
        return this.sendMessageMeta(body)
    }

    sendContacts = async (to: string, contacts: ParsedContact[] = []) => {
        to = parseMetaNumber(to)

        const body = {
            messaging_product: 'whatsapp',
            to,
            type: 'contacts',
            contacts,
        }
        return this.sendMessageMeta(body)
    }

    sendCatalog = async (to: string, text: string, itemCatalogId: string) => {
        to = parseMetaNumber(to)
        const body = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'interactive',
            interactive: {
                type: 'catalog_message',
                body: {
                    text,
                },
                action: {
                    name: 'catalog_message',
                    parameters: {
                        thumbnail_product_retailer_id: itemCatalogId,
                    },
                },
            },
        }
        return this.sendMessageMeta(body)
    }

    sendMessage = async (to: string, message: string, options?: SendOptions): Promise<any> => {
        to = parseMetaNumber(to)
        options = { ...options, ...options['options'] }
        if (options?.buttons?.length) return this.sendButtons(to, options.buttons, message)
        if (options?.media) return this.sendMedia(to, message, options.media)
        this.sendText(to, message)
    }

    sendFile = async (to: string, mediaInput = null) => {
        to = parseMetaNumber(to)
        if (!mediaInput) throw new Error(`MEDIA_INPUT_NULL_: ${mediaInput}`)

        const formData = new FormData()
        const mimeType = mime.lookup(mediaInput)
        formData.append('file', createReadStream(mediaInput), {
            contentType: mimeType,
        })
        formData.append('messaging_product', 'whatsapp')

        const nameOriginal = basename(mediaInput) || 'Doc'

        const {
            data: { id: mediaId },
        } = await axios.post(
            `${URL}/${this.globalVendorArgs.version}/${this.globalVendorArgs.numberId}/media`,
            formData,
            {
                headers: {
                    Authorization: `Bearer ${this.globalVendorArgs.jwtToken}`,
                    ...formData.getHeaders(),
                },
            }
        )

        const body = {
            messaging_product: 'whatsapp',
            to: to,
            type: 'document',
            document: {
                id: mediaId,
                filename: nameOriginal,
            },
        }
        return this.sendMessageMeta(body)
    }

    sendAudio = async (to: string, pathVideo = null) => {
        to = parseMetaNumber(to)
        if (!pathVideo) throw new Error(`MEDIA_INPUT_NULL_: ${pathVideo}`)

        const formData = new FormData()
        const mimeType = mime.lookup(pathVideo)

        if (['audio/ogg'].includes(mimeType)) {
            console.log(
                [
                    `Format (${mimeType}) not supported, you should use`,
                    `https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media#supported-media-types`,
                ].join('\n')
            )
        }
        formData.append('file', createReadStream(pathVideo), {
            contentType: mimeType,
        })
        formData.append('messaging_product', 'whatsapp')
        const {
            data: { id: mediaId },
        } = await axios.post(
            `${URL}/${this.globalVendorArgs.version}/${this.globalVendorArgs.numberId}/media`,
            formData,
            {
                headers: {
                    Authorization: `Bearer ${this.globalVendorArgs.jwtToken}`,
                    ...formData.getHeaders(),
                },
            }
        )

        const body = {
            messaging_product: 'whatsapp',
            to,
            type: 'audio',
            audio: {
                id: mediaId,
            },
        }
        return this.sendMessageMeta(body)
    }

    sendReaction = async (to: string, react: Reaction) => {
        to = parseMetaNumber(to)
        const body = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'reaction',
            reaction: {
                message_id: react.message_id,
                emoji: react.emoji,
            },
        }
        return this.sendMessageMeta(body)
    }

    sendLocation = async (to: string, localization: Localization) => {
        to = parseMetaNumber(to)
        const { long_number, lat_number, name, address } = localization
        const body = {
            messaging_product: 'whatsapp',
            to,
            type: 'location',
            location: {
                name,
                address,
                longitude: long_number,
                latitude: lat_number,
            },
        }
        return this.sendMessageMeta(body)
    }

    sendText = async (to: string, message: string) => {
        to = parseMetaNumber(to)
        const body: TextMessageBody = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'text',
            text: {
                preview_url: false,
                body: message,
            },
        }
        return this.sendMessageMeta(body)
    }

    sendMessageMeta = (body: TextMessageBody): void => {
        return this.queue.add(() => this.sendMessageToApi(body))
    }

    sendMessageToApi = async (body: TextMessageBody): Promise<any> => {
        try {
            const fullUrl = `${URL}/${this.globalVendorArgs.version}/${this.globalVendorArgs.numberId}/messages`
            const response = await axios.post(fullUrl, body, {
                headers: {
                    Authorization: `Bearer ${this.globalVendorArgs.jwtToken}`,
                },
            })
            return response.data
        } catch (error) {
            console.error(error.message)
            throw error
        }
    }
}
export { MetaProvider }
