const ProviderClass = require('./classes/provider.class')
const TwilioProvider = require('./adapters/twilio')
const MockProvider = require('./adapters/mock')

const prepareVendor = ({ vendor, credentials }) => {
    if (vendor === 'twilio') return new TwilioProvider(credentials)
    // if (vendor === 'meta') return new TwilioProvider(credentials)
    // if (vendor === 'wev') return new TwilioProvider(credentials)
    return new MockProvider()
}

/**
 * Crear instancia de clase
 * @param {*} args
 * @returns
 */
const create = (args) => {
    const vendor = prepareVendor(args)
    return Object.setPrototypeOf(new ProviderClass(), vendor)
}

module.exports = { create }
