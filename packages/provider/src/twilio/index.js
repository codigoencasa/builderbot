const twilio = require('twilio')
const { ProviderClass } = require('@bot-whatsapp/bot')

const TwilioWebHookServer = require('./server')
const { parseNumber } = require('./utils')

/**
 * ⚙️TwilioProvider: Es un provedor que te ofrece enviar
 * mensaje a Whatsapp via API
 * info: https://www.twilio.com/es-mx/messaging/whatsapp
 * video: https://youtu.be/KoOmsHylxUw
 *
 * Necesitas las siguientes tokens y valores
 * { accountSid, authToken, vendorNumber }
 */

const PORT = process.env.PORT || 3000

class TwilioProvider extends ProviderClass {
    twilioHook
    vendor
    vendorNumber
    constructor({ accountSid, authToken, vendorNumber, port = PORT }) {
        super()
        this.vendor = new twilio(accountSid, authToken)
        this.twilioHook = new TwilioWebHookServer(port)
        this.vendorNumber = parseNumber(vendorNumber)

        this.twilioHook.start()
        const listEvents = this.busEvents()

        for (const { event, func } of listEvents) {
            this.twilioHook.on(event, func)
        }
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
            event: 'ready',
            func: () => this.emit('ready', true),
        },
        {
            event: 'message',
            func: (payload) => {
                this.emit('message', payload)
            },
        },
    ]

    /**
     * Enviar un archivo multimedia
     * https://www.twilio.com/es-mx/docs/whatsapp/tutorial/send-and-receive-media-messages-whatsapp-nodejs
     * @private
     * @param {*} number
     * @param {*} mediaInput
     * @returns
     */
    sendMedia = async (number, message, mediaInput = null) => {
        if (!mediaInput) throw new Error(`MEDIA_INPUT_NULL_: ${mediaInput}`)
        number = parseNumber(number)
        return this.vendor.messages.create({
            mediaUrl: [`${mediaInput}`],
            body: message,
            from: `whatsapp:+${this.vendorNumber}`,
            to: `whatsapp:+${number}`,
        })
    }

    /**
     * Enviar botones
     * https://www.twilio.com/es-mx/docs/whatsapp/buttons
     * @private
     * @param {*} number
     * @param {*} message
     * @param {*} buttons []
     * @returns
     */
    sendButtons = async () => {
        console.log(``)
        console.log(`[NOTA]: Actualmente enviar botons con Twilio esta en desarrollo`)
        console.log(`[NOTA]: https://www.twilio.com/es-mx/docs/whatsapp/buttons`)
        console.log(``)
    }

    /**
     *
     * @param {*} userId
     * @param {*} message
     * @param {*} param2
     * @returns
     */
    sendMessage = async (number, message, { options }) => {
        number = parseNumber(number)
        if (options?.buttons?.length) this.sendButtons(number, message, options.buttons)
        if (options?.media) return this.sendMedia(number, message, options.media)
        return this.vendor.messages.create({
            body: message,
            from: `whatsapp:+${this.vendorNumber}`,
            to: `whatsapp:+${number}`,
        })
    }
}

module.exports = TwilioProvider
