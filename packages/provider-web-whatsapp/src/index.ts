import { ProviderClass, utils } from '@builderbot/bot'
import type { BotContext, GlobalVendorArgs, SendOptions } from '@builderbot/bot/dist/types'
import { createReadStream, readFileSync } from 'fs'
import { writeFile } from 'fs/promises'
import mime from 'mime-types'
import { tmpdir } from 'os'
import { basename, join, resolve } from 'path'
import type { Middleware } from 'polka'
import type WAWebJS from 'whatsapp-web.js'
import { Client, LocalAuth, MessageMedia, Buttons } from 'whatsapp-web.js'

import {
    wwebCleanNumber,
    wwebDeleteTokens,
    wwebGenerateImage,
    wwebGetChromeExecutablePath,
    wwebIsValidNumber,
} from './utils'

/**
 * ⚙️ WebWhatsappProvider: Es una clase tipo adaptor
 * que extiende clases de ProviderClass (la cual es como interfaz para sber que funciones rqueridas)
 * https://github.com/pedroslopez/whatsapp-web.js
 */
class WebWhatsappProvider extends ProviderClass {
    globalVendorArgs: GlobalVendorArgs = { name: `bot`, gifPlayback: false, port: 3000, writeMyself: 'none' }
    vendor: Client
    constructor(args: { name: string; gifPlayback: boolean }) {
        super()
        this.globalVendorArgs = { ...this.globalVendorArgs, ...args }
    }

    private generateFileName = (extension: string): string => `file-${Date.now()}.${extension}`

    protected initVendor(): Promise<WAWebJS.Client> {
        const NAME_DIR_SESSION = `${this.globalVendorArgs.name}_sessions`

        this.vendor = new Client({
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--unhandled-rejections=strict'],
                executablePath: wwebGetChromeExecutablePath(),
            },
            ...this.globalVendorArgs,
            authStrategy: new LocalAuth({
                clientId: NAME_DIR_SESSION,
            }),
        })

        this.vendor.initialize().catch((e) => {
            console.log(e)
            this.emit('auth_failure', {
                instructions: [`An error occurred during Venom initialization`, `trying again in 5 seconds...`],
            })
            wwebDeleteTokens(NAME_DIR_SESSION)
            setTimeout(async () => {
                console.clear()
                await this.initVendor()
            }, 5000)
        })

        return Promise.resolve(this.vendor)
    }

    protected beforeHttpServerInit(): void {
        this.server = this.server
            .use((req, _, next) => {
                req['globalVendorArgs'] = this.globalVendorArgs
                return next()
            })
            .get('/', this.indexHome)
    }

    public indexHome: Middleware = (req, res) => {
        const botName = req[this.idBotName]
        const qrPath = join(process.cwd(), `${botName}.qr.png`)
        const fileStream = createReadStream(qrPath)
        res.writeHead(200, { 'Content-Type': 'image/png' })
        fileStream.pipe(res)
    }

    protected afterHttpServerInit(): void {
        this.emit('notice', {
            title: '⏱️  Loading... ',
            instructions: [`this process can take up to 90 seconds`, `we will let you know shortly`],
        })
    }

    async saveFile(ctx: BotContext, options?: { path: string }): Promise<string> {
        const fileData: WAWebJS.MessageMedia = ctx.fileData
        const extension = mime.extension(fileData.mimetype) as string
        const fileName = this.generateFileName(extension)
        const pathFile = join(options?.path ?? tmpdir(), fileName)
        const buffer = Buffer.from(fileData.data, 'base64')
        await writeFile(pathFile, buffer)
        return resolve(pathFile)
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
            func: async (
                payload: WAWebJS.Message & {
                    _data: { lng?: string; lat?: string; type?: string }
                    [key: string]: any
                    name: string
                }
            ) => {
                if (payload.from === 'status@broadcast') {
                    return
                }

                if (!wwebIsValidNumber(payload.from)) {
                    return
                }
                payload.from = wwebCleanNumber(payload.from, true)
                payload.name = `${payload?.author}`

                if (payload?.hasMedia) {
                    const media = await payload.downloadMedia()
                    payload.fileData = media
                }

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
    sendVideo = async (number: string, filePath: string, caption: string) => {
        const base64 = readFileSync(filePath, { encoding: 'base64' })
        const mimeType = mime.lookup(filePath)
        const media = new MessageMedia(`${mimeType}`, base64)
        return this.vendor.sendMessage(number, media, {
            sendMediaAsDocument: false,
            caption,
        })
    }

    /**
     * Enviar Arhivos/pdf
     * @param {*} number
     * @param {*} imageUrl
     * @param {*} text
     * @returns
     */
    sendFile = async (number: string, filePath: string, caption: string) => {
        const base64 = readFileSync(filePath, { encoding: 'base64' })
        const mimeType = mime.lookup(filePath)
        const filename = basename(filePath)
        const media = new MessageMedia(`${mimeType}`, base64, filename)
        return this.vendor.sendMessage(number, media, { caption })
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
        if (`${mimeType}`.includes('video')) return this.sendVideo(number, fileDownloaded, text)
        if (`${mimeType}`.includes('audio')) {
            const fileOpus = await utils.convertAudio(fileDownloaded)
            return this.sendAudio(number, fileOpus, text)
        }

        return this.sendFile(number, fileDownloaded, text)
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
