const CoreClass = require('./core/core.class')
const ProviderClass = require('./provider/provider.class')
const FlowClass = require('./io/flow.class')
const { addKeyword, addAnswer } = require('./io/methods')

/**
 * Crear instancia de clase Bot
 * @param {*} args
 * @returns
 */
const createBot = async ({ flow, database, provider }) =>
    new CoreClass(flow, database, provider)

/**
 * Crear instancia de clase Io (Flow)
 * @param {*} args
 * @returns
 */
const createFlow = (args) => {
    return new FlowClass(args)
}

/**
 * Crear instancia de clase Provider
 * @param {*} args
 * @returns
 */
const createProvider = (args) => {
    return new FlowClass(args)
}

module.exports = {
    createBot,
    createFlow,
    createProvider,
    addKeyword,
    addAnswer,
    ProviderClass,
    CoreClass,
}
