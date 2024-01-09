/**
 * @fileoverview Este archivo contiene las definiciones de tipos utilizadas en el proyecto.
 */

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
    ref?: string;
    idle?: number;
    child?: any;
    buttons?: any[];
    media?: string;
    capture?: boolean;
    delay?: number;
    regex?: boolean;
    sensitive?: boolean;
};

/**
 * @typedef ActionPropertiesGeneric
 * @type {Omit<ActionPropertiesKeyword, "sensitive" | "regex">}
 */
export type ActionPropertiesGeneric = Omit<ActionPropertiesKeyword, "sensitive" | "regex">;

/**
 * @typedef IMethodsChain
 * @property {(actionProps: ActionPropertiesGeneric | CallbackFunction, cb?: CallbackFunction) => IMethodsChain} addAction - Añade una acción a la cadena.
 * @property {(message: string | string[], options?: ActionPropertiesKeyword, cb?: CallbackFunction) => IMethodsChain} addAnswer - Añade una respuesta a la cadena.
 */
export type IMethodsChain = {
    addAction: (actionProps: ActionPropertiesGeneric | CallbackFunction, cb?: CallbackFunction) => IMethodsChain;
    addAnswer: (message: string | string[], options?: ActionPropertiesKeyword, cb?: CallbackFunction) => IMethodsChain;
};

/**
 * @typedef BotContext
 * @property {string} [pushName] - Nombre del bot.
 * @property {string} body - Cuerpo del mensaje.
 * @property {string} from - Origen del mensaje.
 */
export type BotContext = {
    pushName?: string;
    body: string;
    from: string;
};

/**
 * @typedef FlowDynamicMessage
 * @property {string} body - Cuerpo del mensaje.
 * @property {number} [delay] - Tiempo de retraso para el mensaje.
 * @property {string} [media] - Medio del mensaje.
 */
export type FlowDynamicMessage = {
    body: string;
    delay?: number;
    media?: string;
};

/**
 * @typedef BotState
 * @property {(props: any) => Promise<void>} update - Actualiza el estado del bot.
 * @property {<K>() => { [key: string]: any | K }} getMyState - Obtiene el estado actual del bot.
 * @property {(prop: string) => any} get - Obtiene una propiedad del estado del bot.
 * @property {() => { [key: string]: any }} getAllState - Obtiene todo el estado del bot.
 * @property {() => void} clear - Limpia el estado del bot.
 */
export type BotState = {
    update: (props: any) => Promise<void>;
    getMyState: <K>() => { [key: string]: any | K };
    get: (prop: string) => any;
    getAllState: () => { [key: string]: any };
    clear: () => void;
};

/**
 * @typedef BotMethods
 * @property {(messages: string | FlowDynamicMessage[]) => Promise<void>} flowDynamic - Define el flujo dinámico del bot.
 * @property {(flow: any) => Promise<void>} gotoFlow - Dirige al bot a un flujo específico.
 * @property {(message?: string) => void} endFlow - Termina el flujo del bot.
 * @property {(message?: string) => void} fallBack - Define la acción de retroceso del bot.
 * @property {BotState} state - Estado del bot.
 * @property {any} extensions - Extensiones del bot.
 */
export type BotMethods = {
    flowDynamic: (messages: string | FlowDynamicMessage[]) => Promise<void>;
    gotoFlow: (flow: any) => Promise<void>;
    endFlow: (message?: string) => void;
    fallBack: (message?: string) => void;
    state: BotState;
    extensions: any;
};

/**
 * @typedef CallbackFunction
 * @type {(context: BotContext, methods: BotMethods) => void}
 */
export type CallbackFunction = (context: BotContext, methods: BotMethods) => void;

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
    media?: null | string;
    buttons?: any[];
    capture?: boolean;
    child?: null | any;
    delay?: number;
    idle?: null | any;
    ref?: null | string;
    nested?: any[];
    keyword?: string | string[] | {};
    callback?: boolean;
}

/**
 * @typedef Callbacks
 * @type {{ [key: string]: () => void }}
 */
export interface Callbacks {
    [key: string]: Function;
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
    ref: string;
    keyword: string | string[];
    from?: string;
    answer?: string | string[];
    refSerialize?: string;
    options: TCTXoptions;
    callbacks?: Callbacks;
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
export interface TFlow {
    ctx: TContext;
    ref: string;
    addAnswer: (answer: string | string[], options?: ActionPropertiesKeyword, cb?: CallbackFunction | null, nested?: TFlow | TFlow[] | null) => TFlow;
    addAction: (actionProps: ActionPropertiesGeneric | CallbackFunction,
        cb?: CallbackFunction) => void;
    toJson: () => TContext[];
}