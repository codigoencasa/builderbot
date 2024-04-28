import { ProviderClass, utils } from '@builderbot/bot'
import type { Vendor } from '@builderbot/bot/dist/provider/interface/provider'
import type { BotContext, Button, SendOptions } from '@builderbot/bot/dist/types'
import axios from 'axios'
import FormData from 'form-data'
import { createReadStream } from 'fs'
import { writeFile } from 'fs/promises'
import mime from 'mime-types'
import { tmpdir } from 'os'
import { join, basename, resolve } from 'path'
import Queue from 'queue-promise'

import { MetaCoreVendor } from './core'
import { downloadFile, getProfile } from '../utils'
import { parseMetaNumber } from '../utils/number'

import type { MetaInterface } from '~/interface/meta'
import type {
    MetaGlobalVendorArgs,
    Localization,
    Message,
    MetaList,
    ParsedContact,
    Reaction,
    SaveFileOptions,
    TextMessageBody,
} from '~/types'

const URL = `https://graph.facebook.com`

class MetaProvider extends ProviderClass<MetaInterface> implements MetaInterface {
    public vendor: Vendor<any>
    public queue: Queue = new Queue()

    public globalVendorArgs: MetaGlobalVendorArgs = {
        name: 'bot',
        jwtToken: '',
        numberId: '',
        verifyToken: '',
        version: 'v18.0',
        port: 3000,
        writeMyself: 'none',
    }
    public prefixMap = {
        '549': '54', // ARG prefix
        '521': '52', // MEX prefix
    }

    constructor(args: MetaGlobalVendorArgs) {
        super()
        this.globalVendorArgs = { ...this.globalVendorArgs, ...args }
        this.queue = new Queue({
            concurrent: 1,
            interval: 100,
            start: true,
        })
    }

    protected beforeHttpServerInit(): void {
        this.server = this.server
            .use((req, _, next) => {
                req['globalVendorArgs'] = this.globalVendorArgs
                return next()
            })
            .post('/', this.vendor.indexHome)
            .get('/webhook', this.vendor.verifyToken)
            .post('/webhook', this.vendor.incomingMsg)
    }

    protected async afterHttpServerInit(): Promise<void> {
        try {
            const { version, numberId, jwtToken } = this.globalVendorArgs
            const profile = await getProfile(version, numberId, jwtToken)
            const host = {
                ...profile,
                phone: profile?.display_phone_number,
            }
            this.vendor.emit('host', host)
            this.emit('ready')
        } catch (err) {
            this.emit('notice', {
                title: '🟠 ERROR AUTH  🟠',
                instructions: [
                    `Error connecting to META, make sure you have the correct credentials, .env`,
                    `https://builderbot.vercel.app/en/providers/meta`,
                ],
            })
        }
    }

    protected initVendor(): Promise<any> {
        const vendor = new MetaCoreVendor(this.queue)
        this.server = this.server
            .use((req, _, next) => {
                req['globalVendorArgs'] = this.globalVendorArgs
                return next()
            })
            .get('/webhook', vendor.verifyToken)
            .post('/webhook', vendor.incomingMsg)

        this.vendor = vendor
        return Promise.resolve(this.vendor)
    }

    protected fixPrefixMetaNumber = (phoneNumber: string) => {
        for (const [prev, current] of Object.entries(this.prefixMap)) {
            if (phoneNumber.startsWith(prev)) {
                return phoneNumber.replace(prev, current)
            }
        }
        return phoneNumber
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
            return resolve(pathFile)
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
            event: 'notice',
            func: ({ instructions, title }) => this.emit('notice', { instructions, title }),
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

    sendImage = async (to: string, mediaInput = null, caption: string) => {
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
                caption,
            },
        }
        return this.sendMessageMeta(body)
    }

    sendImageUrl = async (to: string, url: string, caption = '') => {
        to = parseMetaNumber(to)
        const body = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'image',
            image: {
                link: url,
                caption,
            },
        }
        return this.sendMessageMeta(body)
    }

    sendVideo = async (to: string, pathVideo = null, caption: string) => {
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
                caption,
            },
        }
        return this.sendMessageMeta(body)
    }

    sendVideoUrl = async (to: string, url: string, caption = '') => {
        to = parseMetaNumber(to)
        const body = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'video',
            video: {
                link: url,
                caption,
            },
        }
        return this.sendMessageMeta(body)
    }

    sendMedia = async (to: string, text = '', mediaInput: string) => {
        to = parseMetaNumber(to)
        const fileDownloaded = await utils.generalDownload(mediaInput)
        const mimeType = mime.lookup(fileDownloaded)
        mediaInput = fileDownloaded
        if (mimeType.includes('image')) return this.sendImage(to, mediaInput, text)
        if (mimeType.includes('video')) return this.sendVideo(to, fileDownloaded, text)
        if (mimeType.includes('audio')) {
            const fileOpus = await utils.convertAudio(mediaInput, 'mp3')
            return this.sendAudio(to, fileOpus)
        }

        return this.sendFile(to, mediaInput, text)
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

    sendListComplete = async (
        to: string,
        header: string,
        text: string,
        footer: string,
        button: string,
        list: Record<string, any>
    ) => {
        to = parseMetaNumber(to)
        const parseList = list.map((list) => ({
            title: list.title,
            rows: list.rows.map((row) => ({
                id: row.id,
                title: row.title,
                description: row.description,
            })),
        }))
        const body = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'interactive',
            interactive: {
                type: 'list',
                header: {
                    type: 'text',
                    text: header,
                },
                body: {
                    text: text,
                },
                footer: {
                    text: footer,
                },
                action: {
                    button: button,
                    sections: parseList,
                },
            },
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

    sendButtonsMedia = async (to: string, media_type: string, buttons = [], text: string, url: string) => {
        to = parseMetaNumber(to)
        const parseButtons = buttons.map((btn, i) => ({
            type: 'reply',
            reply: {
                id: `btn-${i}`,
                title: btn.body.slice(0, 15),
            },
        }))
        const body = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'interactive',
            interactive: {
                type: 'button',
                header: {
                    type: media_type,
                    [media_type === 'video' ? 'video' : 'image']: {
                        link: url,
                    },
                },
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

    sendTemplate = async (to: string, template: string, languageCode: string, components = []) => {
        to = parseMetaNumber(to)
        const body = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'template',
            template: {
                name: template,
                language: {
                    code: languageCode, // ---> examples: es_Mx, en_Us
                },
                components: components.length > 0 ? components : [],
            },
        }
        return this.sendMessageMeta(body)
    }

    sendFlow = async (
        to: string,
        headerText: string,
        bodyText: string,
        footerText: string,
        flowID: string,
        flowCta: string,
        screenName: string,
        data = {}
    ) => {
        to = parseMetaNumber(to)
        const body = {
            messaging_product: 'whatsapp',
            to,
            recipient_type: 'individual',
            type: 'interactive',
            interactive: {
                type: 'flow',
                header: {
                    type: 'text',
                    text: headerText,
                },
                body: {
                    text: bodyText,
                },
                footer: {
                    text: footerText,
                },
                action: {
                    name: 'flow',
                    parameters: {
                        flow_message_version: '3',
                        flow_action: 'navigate',
                        flow_token: '<FLOW_TOKEN>', // opcional para cifrado con endpoint
                        flow_id: flowID,
                        flow_cta: flowCta, // open flow! -> mensaje del boton
                        flow_action_payload: {
                            screen: screenName,
                            data: Array.isArray(data) && data.length > 0 ? data : { '<CUSTOM_KEY>': '<CUSTOM_VALUE>' },
                        },
                    },
                },
            },
        }
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

    sendFile = async (to: string, mediaInput = null, caption: string) => {
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
                caption,
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

    sendLocationRequest = async (to: string, bodyText: string) => {
        to = parseMetaNumber(to)
        const body = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'interactive',
            interactive: {
                type: 'location_request_message',
                body: {
                    text: bodyText,
                },
                action: {
                    name: 'send_location',
                },
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
        body.to = this.fixPrefixMetaNumber(body.to)

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
