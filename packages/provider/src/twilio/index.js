const twilio = require('twilio')
const { ProviderClass } = require('@bot-whatsapp/bot')

const TwilioVendor = new twilio(accountSid, authToken)

class TwilioProvider extends ProviderClass {
    constructor() {
        super(TwilioVendor)
    }

    sendMessage = (message) =>
        this.vendor.messages.create({
            body: message,
            to: '+12345678901', // Text this number
            from: '+12345678901', // From a valid Twilio number
        })
}

module.exports = TwilioProvider
