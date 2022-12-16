const DialogFlowClass = require('./dialogflow.class')

/**
 * Crear instancia de clase Bot
 * @param {*} args
 * @returns
 */
const createBotDialog = async ({ flow, database, provider }) =>
    new DialogFlowClass(flow, database, provider)

module.exports = {
    createBotDialog,
    DialogFlowClass,
}
