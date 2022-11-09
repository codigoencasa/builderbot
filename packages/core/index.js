const BotClass = require('./classes/bot.class')

/**
 * Crear instancia de clase
 * @param {*} args
 * @returns
 */
const create = async ({ flow, database, provider }) => {
    return Object.setPrototypeOf(
        new BotClass(flow, database, provider),
        provider
    )
}

module.exports = { create }
