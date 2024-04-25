/**
 * @fileoverview Este archivo contiene las definiciones de tipos utilizadas en el proyecto.
 */

import type { IdleState } from './context'
import type { ProviderClass } from './provider/interface/provider'
import type { Queue } from './utils'

export type CustomNameEvent = string

export type GlobalVendorArgs<V = { [key: string]: any }> = {
    name?: string
    port?: number
    writeMyself?: 'none' | 'host' | 'both'
} & V

export type ProviderEventTypes = {
    message: [arg1: BotContext]
    require_action: [arg1: { title: string; instructions: string[] }]
    notice: [arg1: { title: string; instructions: string[] }]
    ready: any
    auth_failure: any
    host: any
    [key: string]: any
}

export type GeneralArgs = {
    blackList?: string[]
    listEvents?: Record<string, any>
    delay?: number
    globalState?: Record<string, any>
    extensions?: Record<string, any>
    queue?: {
        timeout: number
        concurrencyLimit: number
    }
    host?: string
}

export type FlagsRuntime = { endFlow: any; fallBack?: boolean; flowDynamic?: boolean; gotoFlow?: boolean }

export type Button = {
    body: string
}
/**
 * @typedef ActionPropertiesKeyword
 * @property {string} [ref] - [NO USAR - SOLO DEV] se usa para darle un ID especifico al flow.
 * @property {boolean} [capture] - Indica si se debe capturar la acción.
 * @property {number} [idle] - Tiempo de retraso para respuesta.
 * @property {number} [delay] - Tiempo de retraso para la acción.
 * @property {boolean} [regex] - Indica si se debe usar una expresión regular.
 * @property {boolean} [sensitive] - Indica si la acción es sensible.
 */
export type ActionPropertiesKeyword = {
    /** @deprecated Intern use. */
    ref?: string
    /** @deprecated */
    idle?: number
    buttons?: Button[]
    media?: string
    capture?: boolean
    delay?: number
    regex?: boolean
    sensitive?: boolean
}

/**
 * @typedef ActionPropertiesGeneric
 * @type {Omit<ActionPropertiesKeyword, "sensitive" | "regex">}
 */
export type ActionPropertiesGeneric = Omit<ActionPropertiesKeyword, 'sensitive' | 'regex'>

/**
 * @typedef BotContext
 * @property {string} [name] - Nombre del usuario.
 * @property {string} body - Cuerpo del mensaje.
 * @property {string} from - Origen del mensaje.
 */
export type BotContext = {
    name?: string
    host?: { phone: string; [key: string]: any }
    /** @deprecated */
    idleFallBack?: boolean
    body: string
    from: string
    [key: string]: any
}

export type MessageContextIncoming = {
    from: string
    ref?: string
    body?: string
    host?: string
}

/**
 * @typedef FlowDynamicMessage
 * @property {string} body - Cuerpo del mensaje.
 * @property {number} [delay] - Tiempo de retraso para el mensaje.
 * @property {string} [media] - Medio del mensaje.
 */
export type FlowDynamicMessage = {
    body?: string
    buttons?: Button[]
    delay?: number
    media?: string
}

/**
 * @typedef BotState
 * @property {(props: any) => Promise<void>} update - Actualiza el estado del bot.
 * @property {<K>() => { [key: string]: any | K }} getMyState - Obtiene el estado actual del bot.
 * @property {(prop: string) => any} get - Obtiene una propiedad del estado del bot.
 * @property {() => { [key: string]: any }} getAllState - Obtiene todo el estado del bot.
 * @property {() => void} clear - Limpia el estado del bot.
 */
export type BotState = {
    update: (props: { [key: string]: any }) => Promise<void>
    getMyState: <K = any>() => { [key: string]: K }
    get: <K = any>(prop: string) => K
    getAllState: () => { [key: string]: any }
    clear: () => void
}

export type BotStateStandAlone = Omit<BotState, 'getAllState'>

export type BotStateGlobal = Omit<BotState, 'getMyState'>

export type DynamicBlacklist = {
    add: (phoneNumbers: string | string[]) => string[]
    remove: (phoneNumber: string) => void
    checkIf: (phoneNumber: string) => boolean
    getList: () => string[]
}

/**
 * P = typeof provider
 * B = typeof database
 * @typedef BotMethods
 * @property {(messages: string | FlowDynamicMessage[]) => Promise<void>} flowDynamic - Define el flujo dinámico del bot.
 * @property {(flow: any) => Promise<void>} gotoFlow - Dirige al bot a un flujo específico.
 * @property {(message?: string) => void} endFlow - Termina el flujo del bot.
 * @property {(message?: string) => void} fallBack - Define la acción de retroceso del bot.
 * @property {BotState} state - Estado del bot.
 * @property {any} extensions - Extensiones del bot.
 */
export type BotMethods<P = {}, B = {}> = {
    flowDynamic: (messages: string | string[] | FlowDynamicMessage[], opts?: { delay: number }) => Promise<void>
    gotoFlow: (flow: TFlow<P>, step?: number) => Promise<void>
    endFlow: (message?: string) => void
    fallBack: (message?: string) => void
    provider: P
    database: B
    /** @deprecated */
    inRef: string
    /** @deprecated */
    idle: IdleState
    state: BotStateStandAlone
    blacklist: DynamicBlacklist
    globalState: BotStateGlobal
    queue: Queue<any>
    extensions: Record<string, any>
}

/**
 * @typedef CallbackFunction
 * @type {(context: BotContext, methods: BotMethods) => void}
 */
export type CallbackFunction<P, B> = (context: BotContext, methods: BotMethods<P, B>) => void

/**
 * @typedef TCTXoptions
 * @property {null | string} [media] - Medio del mensaje.
 * @property {any[]} [buttons] - Botones del mensaje.
 * @property {boolean} [capture] - Indica si se debe capturar el mensaje.
 * @property {null | any} [child] - Hijo del mensaje.
 * @property {number} [delay] - Tiempo de retraso para el mensaje.
 * @property {null | any} [idle] - Estado de inactividad del mensaje.
 * @property {null | string} [ref] - Referencia del mensaje.
 * @property {any[]} [nested] - Mensajes anidados.
 * @property {string | string[]} [keyword] - Palabra clave del mensaje.
 * @property {boolean} [callback] - Indica si se debe usar una función de devolución de llamada.
 */
export interface TCTXoptions extends ActionPropertiesKeyword {
    media?: null | string
    buttons?: Button[]
    capture?: boolean
    child?: null | any
    delay?: number
    idle?: null | any
    ref?: null | string
    nested?: any[]
    keyword?: string | string[] | {}
    callback?: boolean
    answer?: string
}

/**
 * @typedef Callbacks
 * @type {{ [key: string]: () => void }}
 */
export interface Callbacks {
    [key: string]: Function
}

/**
 * @typedef TContext
 * @property {string} ref - Referencia del contexto.
 * @property {string} keyword - Palabra clave del contexto.
 * @property {string | string[]} answer - Respuesta del contexto.
 * @property {string} [refSerialize] - Referencia serializada del contexto.
 * @property {TCTXoptions} options - Opciones del contexto.
 * @property {Callbacks} callbacks - Funciones de devolución de llamada del contexto.
 * @property {TContext} json - Objeto JSON del contexto.
 */
export interface TContext {
    ref: string
    keyword: string | string[]
    from?: string
    answer?: string | string[]
    refSerialize?: string
    endFlow?: boolean
    options: TCTXoptions
    callbacks?: Callbacks
    json?: TContext[]
    ctx?: TContext
}

/**
 * @typedef TFlow
 * @property {TContext} ctx - Contexto del flujo.
 * @property {string} ref - Referencia del flujo.
 * @property {(answer: string) => void} addAnswer - Añade una respuesta al flujo.
 * @property {(action: any) => void} addAction - Añade una acción al flujo.
 * @property {() => TContext} toJson - Convierte el flujo a un objeto JSON.
 */
export interface TFlow<P = any, B = any> {
    ctx: TContext
    ref: string
    addAnswer: (
        answer: string | string[],
        options?: ActionPropertiesKeyword | null,
        cb?: CallbackFunction<P, B> | null,
        nested?: TFlow<P, B> | TFlow<P, B>[] | null
    ) => TFlow<P, B>
    addAction: (
        actionProps: ActionPropertiesGeneric | CallbackFunction<P, B>,
        cb?: CallbackFunction<P, B>,
        nested?: TFlow<P, B> | TFlow<P, B>[] | null
    ) => TFlow<P, B>
    toJson: () => TContext[]
}

export interface SendOptions {
    buttons?: Button[]
    media?: string
    [key: string]: any
}

export type DispatchFn = (
    customName: string,
    payload: {
        from: string
        name: string
        [key: string]: any
    }
) => any

export type BotCtxMiddlewareOptions = {
    provider: any
    blacklist: DynamicBlacklist
    dispatch: DispatchFn
    state: (number: string) => BotStateStandAlone
    globalState: () => BotStateGlobal
}

export type BotCtxMiddleware<P = ProviderClass> = Partial<P & BotCtxMiddlewareOptions>
