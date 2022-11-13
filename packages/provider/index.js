const { ProviderClass } = require('@bot-whatsapp/bot')
const MockProvider = require('./mock')
const WebWhatsappProvider = require('./web-whatsapp')
const TwilioProvider = require('./twilio')

module.exports = {
    WebWhatsappProvider,
    MockProvider,
    TwilioProvider,
    ProviderClass,
}
