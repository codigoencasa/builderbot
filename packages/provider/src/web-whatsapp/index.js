const { Client, LocalAuth, MessageMedia, Buttons } = require('whatsapp-web.js')
const { ProviderClass } = require('@bot-whatsapp/bot')
const { Console } = require('console')
const { createWriteStream, readFileSync } = require('fs')
const { wwebCleanNumber, wwebGenerateImage, wwebIsValidNumber } = require('./utils')

const logger = new Console({
    stdout: createWriteStream('./log'),
})

const { generalDownload } = require('../../common/download')
const mime = require('mime-types')

/**
 * ⚙️ WebWhatsappProvider: Es una clase tipo adaptor
 * que extiende clases de ProviderClass (la cual es como interfaz para sber que funciones rqueridas)
 * https://github.com/pedroslopez/whatsapp-web.js
 */
class WebWhatsappProvider extends ProviderClass {
    globalVendorArgs = { name: `bot` }
    vendor
    constructor(args) {
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
                    `(Opcion 2): Intenta actualizar el paquete [npm install whatsapp-web.js] `,
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
            func: (payload) => this.emit('error', payload),
        },
        {
            event: 'qr',
            func: async (qr) => {
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
            func: () => this.emit('ready', true),
        },
        {
            event: 'message',
            func: (payload) => {
                if (payload.from === 'status@broadcast') {
                    return
                }

                if (!wwebIsValidNumber(payload.from)) {
                    return
                }
                payload.from = wwebCleanNumber(payload.from, true)
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
    sendButtons = async (number, message, buttons = []) => {
        console.log(`🚩 ¿No te funciona los botones? Intenta instalar`)
        console.log(`npm i github:pedroslopez/whatsapp-web.js#fix-buttons-list`)

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
    sendText = async (number, message) => {
        return this.vendor.sendMessage(number, message)
    }

    /**
     * Enviar imagen
     * @param {*} number
     * @param {*} imageUrl
     * @param {*} text
     * @returns
     */
    sendImage = async (number, filePath, caption) => {
        const base64 = readFileSync(filePath, { encoding: 'base64' })
        const mimeType = mime.lookup(filePath)
        const media = new MessageMedia(mimeType, base64)
        return this.vendor.sendMessage(number, media, { caption })
    }

    /**
     * Enviar audio
     * @param {*} number
     * @param {*} imageUrl
     * @param {*} text
     * @returns
     */

    sendAudio = async (number, filePath, caption) => {
        const base64 = readFileSync(filePath, { encoding: 'base64' })
        const mimeType = mime.lookup(filePath)
        const media = new MessageMedia(mimeType, base64)
        return this.vendor.sendMessage(number, media, { caption })
    }

    /**
     * Enviar video
     * @param {*} number
     * @param {*} imageUrl
     * @param {*} text
     * @returns
     */
    sendVideo = async (number, filePath) => {
        const base64 = readFileSync(filePath, { encoding: 'base64' })
        const mimeType = mime.lookup(filePath)
        const media = new MessageMedia(mimeType, base64)
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
    sendFile = async (number, filePath) => {
        const base64 = readFileSync(filePath, { encoding: 'base64' })
        const mimeType = mime.lookup(filePath)
        const media = new MessageMedia(mimeType, base64)
        return this.vendor.sendMessage(number, media)
    }

    /**
     * Enviar imagen o multimedia
     * @param {*} number
     * @param {*} mediaInput
     * @param {*} message
     * @returns
     */
    sendMedia = async (number, mediaUrl, text) => {
        const fileDownloaded = await generalDownload(mediaUrl)
        const mimeType = mime.lookup(fileDownloaded)

        if (mimeType.includes('image')) return this.sendImage(number, fileDownloaded, text)
        if (mimeType.includes('video')) return this.sendVideo(number, fileDownloaded)
        if (mimeType.includes('audio')) return this.sendAudio(number, fileDownloaded)

        return this.sendFile(number, fileDownloaded)
    }

    /**
     *
     * @param {*} userId
     * @param {*} message
     * @param {*} param2
     * @returns
     */
    sendMessage = async (userId, message, { options }) => {
        const number = wwebCleanNumber(userId)
        if (options?.buttons?.length) return this.sendButtons(number, message, options.buttons)
        if (options?.media) return this.sendMedia(number, options.media)
        return this.sendText(number, message)
    }
}

module.exports = WebWhatsappProvider
