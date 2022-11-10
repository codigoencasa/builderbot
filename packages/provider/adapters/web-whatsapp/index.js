const { Client, LocalAuth } = require('whatsapp-web.js')
const { ProviderClass } = require('@bot-whatsapp/core')

const { cleanNumber, generateImage } = require('./utils')

const WebWhatsappVendor = new Client({
    authStrategy: new LocalAuth(),
})

class WebWhatsappProvider extends ProviderClass {
    vendor
    constructor(_vendor) {
        super()
        this.vendor = _vendor

        for (const { event, func } of this.busEvents()) {
            this.vendor.on(event, func)
        }

        this.vendor.initialize()
    }

    /**
     * Mapeamos los eventos nativos de  whatsapp-web.js a los que la clase Provider espera
     * para tener un standar de eventos
     * @returns
     */
    busEvents = () => [
        {
            event: 'qr',
            func: (qr) => {
                this.emit('require_action', {
                    instructions: `Debes escanear el QR Code para iniciar session reivsa qr.svg`,
                })
                generateImage(qr)
            },
        },
        {
            event: 'ready',
            func: () => this.emit('ready', true),
        },
        {
            event: 'auth_failure',
            func: (payload) => this.emit('error', payload),
        },
        {
            event: 'authenticated',
            func: () => this.emit('ready', true),
        },
        {
            event: 'message',
            func: (payload) => this.emit('message', payload),
        },
    ]

    sendMessage = async (userId, message) => {
        const number = cleanNumber(userId)
        return this.vendor.sendMessage(number, message)
    }
}

module.exports = new WebWhatsappProvider(WebWhatsappVendor)
