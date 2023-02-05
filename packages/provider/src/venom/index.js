const { ProviderClass } = require('@bot-whatsapp/bot')
const venom = require('venom-bot')
const { createWriteStream } = require('fs')
const { Console } = require('console')
const mime = require('mime-types')

const { venomCleanNumber, venomGenerateImage, venomisValidNumber } = require('./utils')

const logger = new Console({
    stdout: createWriteStream(`${process.cwd()}/venom.log`),
})

const { generalDownload } = require('../../common/download')

/**
 * ⚙️ VenomProvider: Es una clase tipo adaptor
 * que extiende clases de ProviderClass (la cual es como interfaz para sber que funciones rqueridas)
 * https://github.com/orkestral/venom
 */
class VenomProvider extends ProviderClass {
    globalVendorArgs = { name: `bot` }
    vendor
    constructor(args) {
        super()
        this.globalVendorArgs = { ...this.globalVendorArgs, ...args }
        this.init().then(() => this.initBusEvents())
    }

    /**
     * Iniciamos el Proveedor Venom
     */
    init = async () => {
        const NAME_DIR_SESSION = `${this.globalVendorArgs.name}_sessions`
        try {
            const client = await venom.create(
                {
                    session: NAME_DIR_SESSION,
                    multidevice: true,
                    disableSpins: true,
                    disableWelcome: true,
                    logger,
                    logQR: false,
                },
                (base) => this.generateQr(base),
                undefined
            )
            this.vendor = client
        } catch (e) {
            logger.log(e)
            this.emit('auth_failure', {
                instructions: [
                    `Ocurrio un error con la inicializacion de venom`,
                    `Reinicia el BOT`,
                    `Tambien puedes mirar un log que se ha creado venom.log`,
                    `(Puedes abrir un ISSUE) https://github.com/codigoencasa/bot-whatsapp/issues/new/choose`,
                ],
            })
        }
    }

    /**
     * Generamos QR Code pra escanear con el Whatsapp
     */
    generateQr = async (qr) => {
        console.clear()
        this.emit('require_action', {
            instructions: [
                `Debes escanear el QR Code para iniciar ${this.globalVendorArgs.name}.qr.png`,
                `Recuerda que el QR se actualiza cada minuto `,
                `Necesitas ayuda: https://link.codigoencasa.com/DISCORD`,
            ],
        })
        await venomGenerateImage(qr, `${this.globalVendorArgs.name}.qr.png`)
    }

    /**
     * Mapeamos los eventos nativos de  https://docs.orkestral.io/venom/#/?id=events
     * para tener un standar de eventos
     * @returns
     */
    busEvents = () => [
        {
            event: 'onMessage',
            func: (payload) => {
                if (payload.from === 'status@broadcast') {
                    return
                }

                if (!venomisValidNumber(payload.from)) {
                    return
                }
                payload.from = venomCleanNumber(payload.from, true)
                this.emit('message', payload)
            },
        },
    ]

    /**
     * Iniciamos y mapeamos el BusEvent
     * Ejemplo:
     * this.vendor.onMessage() 👉 this.vendor["onMessage"]()
     */
    initBusEvents = () => {
        const listEvents = this.busEvents()

        for (const { event, func } of listEvents) {
            if (this.vendor[event]) this.vendor[event]((payload) => func(payload))
        }
    }

    /**
     * Enviar botones
     * @private
     * @param {*} number
     * @param {*} message
     * @param {*} buttons []
     * @returns
     */
    sendButtons = async (number, message, buttons = []) => {
        const NOTE_VENOM_BUTTON = [`Actualmente VENOM tiene problemas con la API`, `para el envio de Botones`].join(
            '\n'
        )

        console.log(`[NOTA]: ${NOTE_VENOM_BUTTON}`)

        const buttonToStr = [message].concat(buttons.map((btn) => `${btn.body}`)).join(`\n`)
        return this.vendor.sendText(number, buttonToStr)
        // return this.vendor.sendButtons(number, "Title", buttons1, "Description");
    }

    /**
     * Enviar audio
     * @alpha
     * @param {string} number
     * @param {string} message
     * @param {boolean} voiceNote optional
     * @example await sendMessage('+XXXXXXXXXXX', 'audio.mp3')
     */

    sendAudio = async (number, audioPath) => {
        return this.vendor.sendVoice(number, audioPath)
    }

    /**
     * Enviar imagen
     * @param {*} number
     * @param {*} imageUrl
     * @param {*} text
     * @returns
     */
    sendImage = async (number, filePath, text) => {
        return this.vendor.sendImage(number, filePath, 'image-name', text)
    }

    /**
     *
     * @param {string} number
     * @param {string} filePath
     * @example await sendMessage('+XXXXXXXXXXX', './document/file.pdf')
     */

    sendFile = async (number, filePath, text) => {
        const fileName = filePath.split('/').pop()
        return this.vendor.sendFile(number, filePath, fileName, text)
    }

    /**
     * Enviar video
     * @param {*} number
     * @param {*} imageUrl
     * @param {*} text
     * @returns
     */
    sendVideo = async (number, filePath, text) => {
        return this.vendor.sendVideoAsGif(number, filePath, 'video.gif', text)
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
        if (mimeType.includes('video')) return this.sendVideo(number, fileDownloaded, text)
        if (mimeType.includes('audio')) return this.sendAudio(number, fileDownloaded)

        return this.sendFile(number, fileDownloaded, text)
    }

    /**
     * Enviar mensaje al usuario
     * @param {*} userId
     * @param {*} message
     * @param {*} param2
     * @returns
     */
    sendMessage = async (userId, message, { options }) => {
        const number = venomCleanNumber(userId)
        if (options?.buttons?.length) return this.sendButtons(number, message, options.buttons)
        if (options?.media) return this.sendMedia(number, options.media, message)
        return this.vendor.sendText(number, message)
    }
}

module.exports = VenomProvider
