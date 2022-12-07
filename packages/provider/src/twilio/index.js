const twilio = require('twilio')
const { ProviderClass } = require('@bot-whatsapp/bot')

const TwilioWebHookServer = require('./server')
const { parseNumber } = require('./utils')

/**
 * { accountSid, authToken, vendorNumber }
 */
class TwilioProvider extends ProviderClass {
    twilioHook
    vendor
    vendorNumber
    constructor({ accountSid, authToken, vendorNumber }, _port = 3000) {
        super()
        this.vendor = new twilio(accountSid, authToken)
        this.twilioHook = new TwilioWebHookServer(_port)
        this.vendorNumber = vendorNumber

        this.twilioHook.start()
        const listEvents = this.busEvents()

        for (const { event, func } of listEvents) {
            this.twilioHook.on(event, func)
        }
    }

    sendMessage = async (number, message) => {
        return this.vendor.messages.create({
            body: message,
            from: ['whatsapp:+', parseNumber(this.vendorNumber)].join(''),
            to: ['whatsapp:+', parseNumber(number)].join(''),
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
}

module.exports = TwilioProvider
