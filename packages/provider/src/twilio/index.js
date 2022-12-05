const twilio = require('twilio')
const { ProviderClass } = require('@bot-whatsapp/bot')

const WebHookServer = require('./server')
class TwilioProvider extends ProviderClass {
    vendor
    vendorNumber
    constructor({ accountSid, authToken, vendorNumber }) {
        super()
        this.vendor = new twilio(accountSid, authToken)
        this.vendorNumber = vendorNumber
        new WebHookServer().start()
    }

    sendMessage = async (number, message) => {
        return this.vendor.messages.create({
            body: message,
            from: ['whatsapp:', this.vendorNumber].join(''),
            to: ['whatsapp:', number].join(''),
        })
    }
}

module.exports = TwilioProvider
