import { addKeyword, addAnswer, addChild, toSerialize } from './io/methods'
import { LIST_ALL as EVENTS } from './io/events'
import { CoreClass, CoreClassArgs } from './core/coreClass'
import FlowClass from './io/flowClass'
import { ProviderClass } from './provider'

interface GeneralArgs {
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

interface BotCreationArgs {
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

export {
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
