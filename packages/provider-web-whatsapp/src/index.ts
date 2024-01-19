import { ProviderClass, utils } from '@bot-whatsapp/bot'
import { Console } from 'console'
import { createWriteStream, readFileSync } from 'fs'
import mime from 'mime-types'
import WAWebJS, { Client, LocalAuth, MessageMedia, Buttons } from 'whatsapp-web.js'

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
    globalVendorArgs = { name: `bot`, gifPlayback: false }
    vendor: Client
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

        const listEvents = this.busEvents()

        for (const { event, func } of listEvents) {
            this.vendor.on(event, func)
        }

        this.vendor.emit('preinit')

        this.vendor.initialize().catch((e) => {
            logger.log(e)
            this.emit('require_action', {
                instructions: [
                    `(Opcion 1): Debes eliminar la carpeta .wwebjs_auth y reiniciar nuevamente el bot. `,
                    `(Opcion 2): Ejecutar este comando "npm install whatsapp-web.js@latest" `,
                    `(Opcion 3): Ir FORO de discord https://link.codigoencasa.com/DISCORD `,
                ],
            })
        })
    }

    /**
     * Mapeamos los eventos nativos de  whatsapp-web.js a los que la clase Provider espera
     * para tener un standar de eventos
     * @returns
     */
    busEvents = () => [
        {
            event: 'auth_failure',
            func: (payload: any) => this.emit('error', payload),
        },
        {
            event: 'qr',
            func: async (qr: string) => {
                this.emit('require_action', {
                    instructions: [
                        `Debes escanear el QR Code para iniciar ${this.globalVendorArgs.name}.qr.png`,
                        `Recuerda que el QR se actualiza cada minuto `,
                        `Necesitas ayuda: https://link.codigoencasa.com/DISCORD`,
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
            func: (payload: WAWebJS.Message & { _data: { lng?: string; lat?: string; type?: string } }) => {
                if (payload.from === 'status@broadcast') {
                    return
                }

                if (!wwebIsValidNumber(payload.from)) {
                    return
                }
                payload.from = wwebCleanNumber(payload.from, true)
                if (payload._data.lat && payload._data.lng) {
                    payload = { ...payload, body: utils.generateRefprovider('_event_location_') }
                }

                if (payload._data.hasOwnProperty('type') && ['image', 'video'].includes(payload._data.type)) {
                    payload = { ...payload, body: utils.generateRefprovider('_event_media_') }
                }

                if (payload._data.hasOwnProperty('type') && ['document'].includes(payload._data.type)) {
                    payload = { ...payload, body: utils.generateRefprovider('_event_document_') }
                }

                if (payload._data.hasOwnProperty('type') && ['ptt'].includes(payload._data.type)) {
                    payload = { ...payload, body: utils.generateRefprovider('_event_voice_note_') }
                }

                this.emit('message', payload)
            },
        },
    ]

    /**
     * Enviar botones
     * https://docs.wwebjs.dev/Buttons.html
     * @private
     * @param {*} number
     * @param {*} message
     * @param {*} buttons []
     * @returns
     */
    sendButtons = async (number: string, message: any, buttons: any = []) => {
        this.emit(
            'notice',
            [
                `[NOTA]: Actualmente enviar botones no esta disponible con este proveedor`,
                `[NOTA]: esta funcion esta disponible con Meta o Twilio`,
            ].join('\n')
        )
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
    sendImage = async (number: string, filePath: string, caption: undefined) => {
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

    sendAudio = async (number: string, filePath: string, caption: undefined) => {
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
    sendMedia = async (number: string, mediaUrl: string, text: undefined) => {
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
    sendMessage = async (userId: string, message: any, { options }: any): Promise<any> => {
        const number = wwebCleanNumber(userId)
        if (options?.buttons?.length) return this.sendButtons(number, message, options.buttons)
        if (options?.media) return this.sendMedia(number, options.media, message)
        return this.sendText(number, message)
    }
}

export { WebWhatsappProvider }
