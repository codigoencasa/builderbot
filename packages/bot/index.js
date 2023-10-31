const CoreClass = require('./core/core.class')
const ProviderClass = require('./provider/provider.class')
const FlowClass = require('./io/flow.class')
const { addKeyword, addAnswer, addChild, toSerialize } = require('./io/methods')
const { LIST_ALL: EVENTS } = require('./io/events')

/**
 * Crear instancia de clase Bot
 * @param {*} args
 * @returns {CoreClass}
 * @property {Flow} `flowClass` - Instancia de la clase Flow.
 * @property {Database} `databaseClass` - Instancia de la clase Database.
 * @property {Provider} `providerClass` - Instancia de la clase Provider.
 * @property {Queue} `queuePrincipal` - Instancia de la clase Queue.
 * @property {SingleState} `stateHandler` - Instancia de la clase SingleState.
 * @property {GlobalState} `globalStateHandler` - Instancia de la clase GlobalState.
 * @property {Object} `generalArgs` - Argumentos generales que incluyen:
 *   - blackList: Un array de elementos en la lista negra.
 *   - listEvents: Un objeto que almacena eventos.
 *   - delay: Valor de retraso.
 *   - globalState: Un objeto que almacena el estado global.
 *   - extensions: Extensiones, si están definidas.
 *   - queue: Configuración de la cola que incluye timeout y límite de concurrencia.
 */
const createBot = async ({ flow, database, provider }, args = {}) =>
    new CoreClass(flow, database, provider, { ...args, listEvents: EVENTS })

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
 * Depdendiendo del Provider puedes pasar argumentos
 * Ver Documentacion
 * @param {*} args
 * @returns
 */
const createProvider = (providerClass = class {}, args = null) => {
    const providerInstance = new providerClass(args)
    if (!providerClass.prototype instanceof ProviderClass) throw new Error('El provider no implementa ProviderClass')
    return providerInstance
}

module.exports = {
    createBot,
    createFlow,
    createProvider,
    addKeyword,
    addAnswer,
    addChild,
    toSerialize,
    ProviderClass,
    CoreClass,
    EVENTS,
}
