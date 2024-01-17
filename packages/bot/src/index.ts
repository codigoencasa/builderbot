import * as utils from './utils'
import { LIST_ALL as EVENTS } from './io/events'
import FlowClass from './io/flowClass'
import { addKeyword } from './io/methods/addKeyword'
import { addAnswer } from './io/methods/addAnswer'
import { ProviderClass } from './provider/providerClass'
import { CoreClass, CoreClassArgs } from './core/coreClass'

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
    database: any
    provider: ProviderClass
}

/**
 * Crear instancia de clase Bot
 */
const createBot = async ({ flow, database, provider }: BotCreationArgs, args: GeneralArgs = {}): Promise<CoreClass> => {
    const defaultArgs: CoreClassArgs = {
        blackList: [],
        listEvents: {},
        delay: 0,
        globalState: {},
        extensions: [],
        queue: {
            timeout: 0,
            concurrencyLimit: 0,
        },
    }

    const combinedArgs: CoreClassArgs = { ...defaultArgs, ...args }
    return new CoreClass(flow, database, provider, combinedArgs)
}

/**
 * Crear instancia de clase Io (Flow)
 */
const createFlow = (args: any): FlowClass => {
    return new FlowClass(args)
}

/**
 * Crear instancia de clase Provider
 * Depdendiendo del Provider puedes pasar argumentos
 * Ver Documentacion
 */
const createProvider = <T extends ProviderClass>(providerClass: new (args: any) => T, args: any = null): T => {
    const providerInstance = new providerClass(args)
    if (!(providerInstance instanceof ProviderClass)) {
        throw new Error('El provider no implementa ProviderClass')
    }
    return providerInstance
}

export { createBot, createFlow, createProvider, addKeyword, addAnswer, ProviderClass, CoreClass, EVENTS, utils }
