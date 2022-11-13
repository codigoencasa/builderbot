const CoreClass = require('./core/core.class')
const ProviderClass = require('./provider/provider.class')
const FlowClass = require('./io/flow.class')
const { addKeyword, addAnswer } = require('./io/methods')

/**
 * Crear instancia de clase
 * @param {*} args
 * @returns
 */
const createBot = async ({ flow, database, provider }) =>
    new CoreClass(flow, database, provider)

/**
 * Crear instancia de clase
 * @param {*} args
 * @returns
 */
const createFlow = (args) => {
    return new FlowClass(args)
}

module.exports = {
    createBot,
    createFlow,
    addKeyword,
    addAnswer,
    ProviderClass,
    CoreClass,
}
