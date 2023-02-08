const DialogFlowClass = require('./dialogflow.class')

/**
 * Crear instancia de clase Bot
 * @param {*} args
 * @returns
 */
const createBotDialog = async ({ database, provider }) => new DialogFlowClass(database, provider)

module.exports = {
    createBotDialog,
    DialogFlowClass,
}
