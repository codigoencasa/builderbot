const MockProvider = require('./mock')
const WebWhatsappProvider = require('./web-whatsapp')
const TwilioProvider = require('./twilio')
const { ProviderClass } = require('@bot-whatsapp/bot')

module.exports = {
    WebWhatsappProvider,
    MockProvider,
    TwilioProvider,
    ProviderClass,
}
