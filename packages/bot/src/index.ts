import { CoreClass, CoreClassArgs } from './core/coreClass'
import { MemoryDBClass } from './db'
import { LIST_ALL as EVENTS } from './io/events'
import FlowClass from './io/flowClass'
import { addAnswer } from './io/methods/addAnswer'
import { addKeyword } from './io/methods/addKeyword'
import { ProviderClass } from './provider/providerClass'
import { TFlow } from './types'
import * as utils from './utils'

export interface GeneralArgs {
    blackList?: any[]
    listEvents?: Record<string, any>
    delay?: number
    globalState?: Record<string, any>
    extensions?: any[]
    queue?: {
        timeout: number
        concurrencyLimit: number
    }
}

export interface BotCreationArgs {
    flow: FlowClass
    database: MemoryDBClass
    provider: ProviderClass
}

/**
 * Crear instancia de clase Bot
 */
const createBot = async ({ flow, database, provider }: BotCreationArgs, args: GeneralArgs = {}): Promise<CoreClass> => {
    const defaultArgs: CoreClassArgs = {
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

    const combinedArgs: CoreClassArgs = { ...defaultArgs, ...args }
    return new CoreClass(flow, database, provider, combinedArgs)
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
const createProvider = <T extends ProviderClass, K = typeof ProviderClass.prototype.globalVendorArgs>(
    providerClass: new (args: K) => T,
    args: K = null
): T => {
    const providerInstance = new providerClass(args)
    if (!(providerClass.prototype instanceof ProviderClass)) {
        throw new Error('El provider no implementa ProviderClass')
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
    MemoryDBClass as MemoryDB,
    utils,
}
