import { ProviderClass, utils } from '@builderbot/bot'
import type { BotCtxMiddleware, BotCtxMiddlewareOptions, SendOptions } from '@builderbot/bot/dist/types'
import { Console } from 'console'
import { createWriteStream, readFileSync } from 'fs'
import mime from 'mime-types'
import type WAWebJS from 'whatsapp-web.js'
import { Client, LocalAuth, MessageMedia, Buttons } from 'whatsapp-web.js'

import { WebWhatsappHttpServer } from './server'
import { wwebCleanNumber, wwebGenerateImage, wwebIsValidNumber } from './utils'

const logger = new Console({
    stdout: createWriteStream('./log'),
})

/**
 * ⚙️ WebWhatsappProvider: Es una clase tipo adaptor
 * que extiende clases de ProviderClass (la cual es como interfaz para sber que funciones rqueridas)
 * https://github.com/pedroslopez/whatsapp-web.js
 */
class WebWhatsappProvider extends ProviderClass {
    globalVendorArgs = { name: `bot`, gifPlayback: false, port: 3000 }
    vendor: Client
    http: WebWhatsappHttpServer | undefined
    constructor(args: { name: string; gifPlayback: boolean }) {
        super()
        this.globalVendorArgs = { ...this.globalVendorArgs, ...args }
        this.vendor = new Client({
            authStrategy: new LocalAuth({
                clientId: `${this.globalVendorArgs.name}_sessions`,
            }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--unhandled-rejections=strict'],
                //executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            },
        })
        this.http = new WebWhatsappHttpServer(this.globalVendorArgs.name, this.globalVendorArgs.port)
        const listEvents = this.busEvents()

        for (const { event, func } of listEvents) {
            this.vendor.on(event, func)
        }

        this.vendor.initialize().catch((e) => {
            logger.log(e)
            this.emit('require_action', {
                title: '❌ ERROR ❌',
                instructions: [
                    `(Option 1): You must delete the .wwebjs_auth folder and restart the bot.`,
                    `(Option 2): Run this command "npm install whatsapp-web.js@latest".`,
                    `(Option 3): Visit the Discord forum at https://link.codigoencasa.com/DISCORD.`,
                ],
            })
        })
    }

    /**
     *
     * @param port
     * @param opts
     * @returns
     */
    initHttpServer = (port: number, opts: Pick<BotCtxMiddlewareOptions, 'blacklist'>) => {
        const methods: BotCtxMiddleware<WebWhatsappProvider> = {
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
        this.http.start(methods, port)
        return
    }

    /**
     * Mapeamos los eventos nativos de  whatsapp-web.js a los que la clase Provider espera
     * para tener un standar de eventos
     * @returns
     */
    busEvents = () => [
        {
            event: 'auth_failure',
            func: (payload: any) => this.emit('auth_failure', payload),
        },
        {
            event: 'qr',
            func: async (qr: string) => {
                this.emit('require_action', {
                    title: '⚡⚡ ACTION REQUIRED ⚡⚡',
                    instructions: [
                        `You must scan the QR Code`,
                        `Remember that the QR code updates every minute`,
                        `Need help: https://link.codigoencasa.com/DISCORD`,
                    ],
                })
                await wwebGenerateImage(qr, `${this.globalVendorArgs.name}.qr.png`)
            },
        },
        {
            event: 'ready',
            func: () => {
                const host = { ...this.vendor?.info?.wid, phone: this.vendor?.info?.wid?.user }
                this.emit('ready', true)
                this.emit('host', host)
            },
        },
        {
            event: 'message',
            func: (
                payload: WAWebJS.Message & { _data: { lng?: string; lat?: string; type?: string }; name: string }
            ) => {
                if (payload.from === 'status@broadcast') {
                    return
                }

                if (!wwebIsValidNumber(payload.from)) {
                    return
                }
                payload.from = wwebCleanNumber(payload.from, true)
                payload.name = `${payload?.author}`

                if (payload?._data?.lat && payload?._data?.lng) {
                    payload = { ...payload, body: utils.generateRefProvider('_event_location_') }
                }

                if (payload._data.hasOwnProperty('type') && ['image', 'video'].includes(payload._data.type)) {
                    payload = { ...payload, body: utils.generateRefProvider('_event_media_') }
                }

                if (payload._data.hasOwnProperty('type') && ['document'].includes(payload._data.type)) {
                    payload = { ...payload, body: utils.generateRefProvider('_event_document_') }
                }

                if (payload._data.hasOwnProperty('type') && ['ptt'].includes(payload._data.type)) {
                    payload = { ...payload, body: utils.generateRefProvider('_event_voice_note_') }
                }

                this.emit('message', payload)
            },
        },
    ]

    /**
     * @deprecated Buttons are not available in this provider, please use sendButtons instead
     * @private
     * @private
     * @param {*} number
     * @param {*} message
     * @param {*} buttons []
     * @returns
     */
    sendButtons = async (number: string, message: any, buttons: any = []) => {
        this.emit('notice', {
            title: 'DEPRECATED',
            instructions: [
                `Currently sending buttons is not available with this provider`,
                `this function is available with Meta or Twilio`,
            ],
        })
        const buttonMessage = new Buttons(message, buttons, '', '')
        return this.vendor.sendMessage(number, buttonMessage)
    }

    /**
     * Enviar lista
     * https://docs.wwebjs.dev/List.html
     * @private
     * @alpha No funciona en whatsapp bussines
     * @param {*} number
     * @param {*} message
     * @param {*} buttons []
     * @returns
     */
    // sendList = async (number, message, listInput = []) => {
    //     let sections = [
    //         {
    //             title: 'sectionTitle',
    //             rows: [
    //                 { title: 'ListItem1', description: 'desc' },
    //                 { title: 'ListItem2' },
    //             ],
    //         },
    //     ]
    //     let list = new List('List body', 'btnText', sections, 'Title', 'footer')
    //     return this.vendor.sendMessage(number, list)
    // }

    /**
     * Enviar un mensaje solo texto
     * https://docs.wwebjs.dev/Message.html
     * @private
     * @param {*} number
     * @param {*} message
     * @returns
     */
    sendText = async (number: string, message: WAWebJS.MessageContent) => {
        return this.vendor.sendMessage(number, message)
    }

    /**
     * Enviar imagen
     * @param {*} number
     * @param {*} imageUrl
     * @param {*} text
     * @returns
     */
    sendImage = async (number: string, filePath: string, caption: string) => {
        const base64 = readFileSync(filePath, { encoding: 'base64' })
        const mimeType = mime.lookup(filePath)
        const media = new MessageMedia(`${mimeType}`, base64)
        return this.vendor.sendMessage(number, media, { caption })
    }

    /**
     * Enviar audio
     * @param {*} number
     * @param {*} imageUrl
     * @param {*} text
     * @returns
     */

    sendAudio = async (number: string, filePath: string, caption: string) => {
        const base64 = readFileSync(filePath, { encoding: 'base64' })
        const mimeType = mime.lookup(filePath)
        const media = new MessageMedia(`${mimeType}`, base64)
        return this.vendor.sendMessage(number, media, { caption })
    }

    /**
     * Enviar video
     * @param {*} number
     * @param {*} imageUrl
     * @param {*} text
     * @returns
     */
    sendVideo = async (number: string, filePath: string) => {
        const base64 = readFileSync(filePath, { encoding: 'base64' })
        const mimeType = mime.lookup(filePath)
        const media = new MessageMedia(`${mimeType}`, base64)
        return this.vendor.sendMessage(number, media, {
            sendMediaAsDocument: true,
        })
    }

    /**
     * Enviar Arhivos/pdf
     * @param {*} number
     * @param {*} imageUrl
     * @param {*} text
     * @returns
     */
    sendFile = async (number: string, filePath: string) => {
        const base64 = readFileSync(filePath, { encoding: 'base64' })
        const mimeType = mime.lookup(filePath)
        const media = new MessageMedia(`${mimeType}`, base64)
        return this.vendor.sendMessage(number, media)
    }

    /**
     * Enviar imagen o multimedia
     * @param {*} number
     * @param {*} mediaInput
     * @param {*} message
     * @returns
     */
    sendMedia = async (number: string, mediaUrl: string, text: string) => {
        const fileDownloaded = await utils.generalDownload(mediaUrl)
        const mimeType = mime.lookup(fileDownloaded)

        if (`${mimeType}`.includes('image')) return this.sendImage(number, fileDownloaded, text)
        if (`${mimeType}`.includes('video')) return this.sendVideo(number, fileDownloaded)
        if (`${mimeType}`.includes('audio')) {
            const fileOpus = await utils.convertAudio(fileDownloaded)
            return this.sendAudio(number, fileOpus, text)
        }

        return this.sendFile(number, fileDownloaded)
    }

    /**
     * Funcion SendRaw envia opciones directamente del proveedor
     * @param {string} number
     * @param {string} message
     * @example await sendMessage('+XXXXXXXXXXX', 'Hello World')
     */

    sendRaw = () => this.vendor.sendMessage
    /**
     *
     * @param {*} userId
     * @param {*} message
     * @param {*} param2
     * @returns
     */
    sendMessage = async (number: string, message: string, options?: SendOptions): Promise<any> => {
        options = { ...options, ...options['options'] }
        number = wwebCleanNumber(number)
        if (options?.buttons?.length) return this.sendButtons(number, message, options.buttons)
        if (options?.media) return this.sendMedia(number, options.media, message)
        return this.sendText(number, message)
    }
}

export { WebWhatsappProvider }
