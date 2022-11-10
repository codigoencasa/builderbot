const { createWriteStream } = require('fs')
const qr = require('qr-image')
const { Client, LocalAuth } = require('whatsapp-web.js')

//TODO: Acoplamiento OJO
const { ProviderClass } = require('../../index').botcore

const WebWhatsappVendor = new Client({
    authStrategy: new LocalAuth(),
})

/**
 *  TODO esto se debe mover a un utils.js
 * @param {*} number
 * @returns
 */
const cleanNumber = (number) => {
    number = number.replace('@c.us', '')
    number = `${number}@c.us`
    return number
}

const generateImage = (base64) => {
    let qr_svg = qr.image(base64, { type: 'svg', margin: 4 })
    qr_svg.pipe(createWriteStream(`${process.cwd()}/qr.svg`))
    console.log(`⚡ Recuerda que el QR se actualiza cada minuto ⚡'`)
    console.log(`⚡ Actualiza F5 el navegador para mantener el mejor QR⚡`)
}

//////////////////////////////////////////////////////

class WebWhatsappProvider extends ProviderClass {
    vendor
    constructor(_vendor) {
        super()
        this.vendor = _vendor

        this.vendor.on('qr', (qr) => {
            this.emit('require_action', {
                eventName: 'require_action',
                instructions: `Debes escanear el QR Code para iniciar session reivsa qr.svg`,
            })
            generateImage(qr)
        })
        this.vendor.on('ready', (ready) =>
            this.emit('ready', { eventName: 'ready', ...ready })
        )
        this.vendor.on('auth_failure', (error) =>
            this.emit('error', { eventName: 'error', ...error })
        )
        this.vendor.on('authenticated', (authenticated) =>
            this.emit('ready', { eventName: 'authenticated', ...authenticated })
        )

        this.vendor.on('message', (message) =>
            this.emit('message', { eventName: 'message', ...message })
        )

        this.vendor.initialize()
    }

    sendMessage = async (userId, message) => {
        const number = cleanNumber(userId)
        return this.vendor.sendMessage(number, message)
    }
}

/**
 * Injectamos!
 */
module.exports = new WebWhatsappProvider(WebWhatsappVendor)
