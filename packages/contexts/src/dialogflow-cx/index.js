const DialogCXFlowClass = require('./dialogflow-cx.class')

/**
 * Crear instancia de clase Bot
 * @param {*} args
 * @returns
 */
const createBotDialog = async ({ database, provider }, _options) => new DialogCXFlowClass(database, provider, _options)

module.exports = {
    createBotDialog,
    DialogCXFlowClass,
}
