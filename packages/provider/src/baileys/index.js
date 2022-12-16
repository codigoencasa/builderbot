const { ProviderClass } = require('@bot-whatsapp/bot')
const { createHttpServer } = require('../server')
const pino = require('pino')
const mime = require('mime-types')
const fs = require('fs')
const {
    default: makeWASocket,
    useMultiFileAuthState,
} = require('@adiwajshing/baileys')
const {
    baileyGenerateImage,
    baileyCleanNumber,
    baileyIsValidNumber,
} = require('./utils')

/**
 * ⚙️ BaileysProvider: Es una clase tipo adaptor
 * que extiende clases de ProviderClass (la cual es como interfaz para sber que funciones rqueridas)
 * https://github.com/adiwajshing/Baileys
 */
class BaileysProvider extends ProviderClass {
    vendor
    constructor() {
        super()
        this.initBailey().then(() => this.initBusEvents())
    }

    /**
     * Iniciar todo Bailey
     */
    async initBailey() {
        const { state, saveCreds } = await useMultiFileAuthState('sessions')

        try {
            this.vendor = makeWASocket({
                printQRInTerminal: false,
                auth: state,
                logger: pino({ level: 'error' }),
            })

            this.vendor.ev.on(
                'connection.update',
                async ({ qr, connection, lastDisconnect }) => {
                    if (qr) {
                        baileyGenerateImage(qr)
                        createHttpServer()
                    }
                    if (connection === 'open') this.emit('ready', true)
                    if (lastDisconnect?.error) {
                        saveCreds()
                        this.initBailey()
                    }
                }
            )
        } catch (e) {
            this.emit('error', e)
        }
    }

    /**
     * Mapeamos los eventos nativos a los que la clase Provider espera
     * para tener un standar de eventos
     * @returns
     */
    busEvents = () => [
        {
            event: 'connection.update',
            func: async ({ qr, connection, lastDisconnect }) => {
                if (qr) {
                    this.emit('require_action', {
                        instructions: [
                            `Debes escanear el QR Code para iniciar session reivsa qr.png`,
                            `Recuerda que el QR se actualiza cada minuto `,
                            `Necesitas ayuda: https://link.codigoencasa.com/DISCORD`,
                        ],
                    })
                    baileyGenerateImage(qr)
                }

                if (lastDisconnect?.error) {
                    this.emit('require_action', {
                        instructions: [
                            `Algo sucedio reinicia el bot o revisa tu whatsapp`,
                            `Necesitas ayuda: https://link.codigoencasa.com/DISCORD`,
                        ],
                    })
                }

                if (connection === 'open') this.emit('ready', true)
            },
        },
        {
            event: 'messages.upsert',
            func: ({ messages }) => {
                const [messageCtx] = messages
                let payload = {
                    ...messageCtx,
                    body: messageCtx?.message?.conversation,
                    from: messageCtx?.key?.remoteJid,
                }
                if (payload.from === 'status@broadcast') {
                    return
                }

                if (!baileyIsValidNumber(payload.from)) {
                    return
                }
                payload.from = baileyCleanNumber(payload.from, true)
                this.emit('message', payload)
            },
        },
    ]

    initBusEvents = () => {
        const listEvents = this.busEvents()

        for (const { event, func } of listEvents) {
            this.vendor.ev.on(event, func)
        }
    }

    /**
     * @alpha
     * @param {string} number
     * @param {string} message
     * @example await sendMessage('+XXXXXXXXXXX', 'https://dominio.com/imagen.jpg' | 'img/imagen.jpg')
     */

    sendMedia = async (number, imageUrl) => {
        await this.vendor.sendMessage(number, {
            image: { url: imageUrl },
        })
    }

    /**
     * @alpha
     * @param {string} number
     * @param {string} message
     * @param {boolean} voiceNote optional
     * @example await sendMessage('+XXXXXXXXXXX', 'audio.mp3')
     */

    sendAudio = async (number, audioUrl, voiceNote = false) => {
        const numberClean = number.replace('+', '')
        await this.vendor.sendMessage(`${numberClean}@c.us`, {
            audio: { url: audioUrl },
            ptt: voiceNote,
        })
    }

    /**
     *
     * @param {string} number
     * @param {string} message
     * @returns
     */
    sendText = async (number, message) => {
        return this.vendor.sendMessage(number, { text: message })
    }
    /**
     * TODO: Necesita terminar de implementar el sendMedia y sendButton guiarse:
     * https://github.com/leifermendez/bot-whatsapp/blob/4e0fcbd8347f8a430adb43351b5415098a5d10df/packages/provider/src/web-whatsapp/index.js#L165
     * @param {string} number
     * @param {string} message
     * @example await sendMessage('+XXXXXXXXXXX', 'Hello World')
     */
    sendMessage = async (numberIn, message, { options }) => {
        const number = baileyCleanNumber(numberIn)

        // if (options?.buttons?.length)
        //     return this.sendButtons(number, message, options.buttons)
        if (options?.media) return this.sendMedia(number, options.media)
        return this.sendText(number, message)
    }

    /**
     *
     * @param {string} number
     * @param {string} filePath
     * @example await sendMessage('+XXXXXXXXXXX', './document/file.pdf')
     */

    sendFile = async (number, filePath) => {
        if (fs.existsSync(filePath)) {
            const mimeType = mime.lookup(filePath)
            const numberClean = number.replace('+', '')
            const fileName = filePath.split('/').pop()

            await this.vendor.sendMessage(`${numberClean}@c.us`, {
                document: { url: filePath },
                mimetype: mimeType,
                fileName: fileName,
            })
        }
    }

    /**
     *
     * @param {string} number
     * @param {string} text
     * @param {string} footer
     * @param {Array} buttons
     * @example await sendMessage("+XXXXXXXXXXX", "Your Text", "Your Footer", [{"buttonId": "id", "buttonText": {"displayText": "Button"}, "type": 1}])
     */

    sendButtons = async (number, text, footer, buttons) => {
        const numberClean = number.replace('+', '')

        const buttonMessage = {
            text: text,
            footer: footer,
            buttons: buttons,
            headerType: 1,
        }

        await this.vendor.sendMessage(`${numberClean}@c.us`, buttonMessage)
    }
}

module.exports = BaileysProvider
