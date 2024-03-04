import { CoreClass } from './core/coreClass'
import { MemoryDB } from './db'
import { LIST_ALL as EVENTS } from './io/events'
import FlowClass from './io/flowClass'
import { addAnswer } from './io/methods/addAnswer'
import { addKeyword } from './io/methods/addKeyword'
import { ProviderClass } from './provider/providerClass'
import { GeneralArgs, TFlow } from './types'
import * as utils from './utils'

/**
 * Crear instancia de clase Bot
 */
const createBot = async <P extends ProviderClass = any, D extends MemoryDB = any>(
    { flow, database, provider }: { flow: FlowClass; database: D; provider: P },
    args?: GeneralArgs
): Promise<CoreClass<P, D>> => {
    const defaultArgs: GeneralArgs = {
        blackList: [],
        listEvents: EVENTS,
        delay: 0,
        globalState: {},
        extensions: [],
        queue: {
            timeout: 50000,
            concurrencyLimit: 15,
        },
    }

    const combinedArgs: GeneralArgs = { ...defaultArgs, ...args }
    return new CoreClass<P, D>(flow, database, provider, combinedArgs)
}

/**
 * Crear instancia de clase Io (Flow)
 */
const createFlow = (args: TFlow[]): FlowClass => {
    return new FlowClass(args)
}

/**
 * Crear instancia de clase Provider
 * Depdendiendo del Provider puedes pasar argumentos
 * Ver Documentacion
 */
const createProvider = <T = ProviderClass, K = typeof ProviderClass.prototype.globalVendorArgs>(
    providerClass: new (args: K) => T,
    args: K = null
): T => {
    const providerInstance = new providerClass(args)
    if (!(providerClass.prototype instanceof ProviderClass)) {
        throw new Error('Provider does not implement ProviderClass')
    }
    return providerInstance
}

export {
    createBot,
    createFlow,
    createProvider,
    addKeyword,
    addAnswer,
    ProviderClass,
    CoreClass,
    EVENTS,
    MemoryDB,
    utils,
}
