const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js')
const { ProviderClass } = require('@bot-whatsapp/bot')
const { Console } = require('console')
const { createWriteStream, existsSync } = require('fs')
const { cleanNumber, generateImage, isValidNumber } = require('./utils')

const logger = new Console({
    stdout: createWriteStream('./log'),
})

class WebWhatsappProvider extends ProviderClass {
    vendor
    constructor() {
        super()
        this.vendor = new Client({
            authStrategy: new LocalAuth(),
        })

        const listEvents = this.busEvents()

        for (const { event, func } of listEvents) {
            this.vendor.on(event, func)
        }

        this.vendor.initialize().catch((e) => {
            logger.log(e)
            this.emit('require_action', {
                instructions: [
                    `Debes eliminar la carpeta .wwebjs_auth`,
                    `y reiniciar nuevamente el bot `,
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
            func: (qr) => {
                this.emit('require_action', {
                    instructions: [
                        `Debes escanear el QR Code para iniciar session reivsa qr.svg`,
                        `Recuerda que el QR se actualiza cada minuto `,
                        `Necesitas ayuda: https://link.codigoencasa.com/DISCORD`,
                    ],
                })
                generateImage(qr)
            },
        },
        {
            event: 'ready',
            func: () => this.emit('ready', true),
        },
        {
            event: 'authenticated',
            func: () => this.emit('ready', true),
        },
        {
            event: 'message',
            func: (payload) => {
                if (payload.from === 'status@broadcast') {
                    return
                }

                if (!isValidNumber(payload.from)) {
                    return
                }
                payload.from = cleanNumber(payload.from, true)
                this.emit('message', payload)
            },
        },
    ]

    sendMedia = async (number, mediaInput = null) => {
        if (!existsSync(mediaInput))
            throw new Error(`NO_SE_ENCONTRO: ${mediaInput}`)
        const media = MessageMedia.fromFilePath(mediaInput)
        return this.vendor.sendMessage(number, media)
    }

    sendText = async (number, message) => {
        return this.vendor.sendMessage(number, message)
    }

    sendMessage = async (userId, message, { options }) => {
        const number = cleanNumber(userId)
        if (options?.media) return this.sendMedia(number, options.media)
        return this.sendText(number, message)
    }
}

module.exports = WebWhatsappProvider
