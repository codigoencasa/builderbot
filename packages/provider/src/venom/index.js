const { ProviderClass } = require('@bot-whatsapp/bot')
const venom = require('venom-bot')
const { cleanNumber, generateImage } = require('./utils/utils')

class VenomProvider extends ProviderClass {
    constructor() {
        super()
        this.vendor
        venom
            .create(
                {
                    session: 'session-1', //nombre de la sesion o id
                    multidevice: true,
                },
                (base64Qrimg) => this.generateQr(base64Qrimg)
            )
            .then((client) => {
                this.vendor = client
                this.start()
            })
            .catch((erro) => {
                console.log(erro)
            })
    }

    generateQr = (qr) => {
        this.emit('require_action', {
            instructions: [
                `Debes escanear el QR Code para iniciar session reivsa qr.svg`,
                `Recuerda que el QR se actualiza cada minuto `,
                `Necesitas ayuda: https://link.codigoencasa.com/DISCORD`,
            ],
        })
        //generateImage(qr)
    }

    start = () => {
        this.vendor.onMessage((payload) => {
            payload.from = cleanNumber(payload.from, true)
            this.emit('message', payload)
        })
    }

    sendMessage = async (number, message) => {
        const numero = cleanNumber(number)
        return this.client.sendText(numero, message)
    }

    sendButtons = async (number, message, buttons = []) => {
        const buttonMessage = new Buttons(message, buttons, '', '')
        return this.vendor.sendMessage(number, buttonMessage)
    }

    sendMessage = async (userId, message, { options }) => {
        console.log('entramos')
        const number = cleanNumber(userId)
        if (options?.buttons?.length)
            return this.sendButtons(number, message, options.buttons)
        if (options?.media) return this.sendMedia(number, options.media)
        return this.vendor.sendText(number, message)
    }
}

module.exports = VenomProvider
