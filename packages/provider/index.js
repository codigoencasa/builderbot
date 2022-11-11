const MockProvider = require('./adapters/mock')
const WebWhatsappProvider = require('./adapters/web-whatsapp')
const TwilioProvider = require('./adapters/twilio')
const { ProviderClass } = require('@bot-whatsapp/core')

module.exports = {
    WebWhatsappProvider,
    MockProvider,
    TwilioProvider,
    ProviderClass,
}
