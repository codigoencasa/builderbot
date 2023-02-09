const MOCK_DB = require('../packages/database/src/mock')
const PROVIDER_DB = require('../packages/provider/src/mock')

/**
 * Preparar env para el test
 * @param {*} context
 */
const setup = async (context) => {
    context.provider = new PROVIDER_DB()
    context.database = new MOCK_DB()
}

const clear = async (context) => {
    context.provider = null
    context.database = null
}

function delay(ms) {
    return new Promise((res) => setTimeout(res, ms))
}

module.exports = { setup, clear, delay }
