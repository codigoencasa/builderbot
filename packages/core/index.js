const BotClass = require('./classes/bot.class')
const ProviderClass = require('./classes/provider.class')

/**
 * Crear instancia de clase
 * @param {*} args
 * @returns
 */
const create = async ({ flow, database, provider }) => {
    new BotClass(flow, database, provider)
}

module.exports = { create, ProviderClass }
