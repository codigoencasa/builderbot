import { Console } from 'console'
import { createWriteStream } from 'fs'
import { EventEmitter } from 'node:events'

import { DispatchFn, DynamicBlacklist } from './../types'
import { GlobalState, IdleState, SingleState } from '../context'
import { MemoryDB } from '../db'
import { LIST_REGEX } from '../io/events'
import FlowClass from '../io/flowClass'
import { toCtx } from '../io/methods'
import { ProviderClass } from '../provider'
import { FlowDynamicMessage, GeneralArgs, MessageContextIncoming } from '../types'
import { BlackList, Queue } from '../utils'
import { delay } from '../utils/delay'
import { printer } from '../utils/interactive'

const logger = new Console({
    stdout: createWriteStream(`${process.cwd()}/core.class.log`),
})
const loggerQueue = new Console({
    stdout: createWriteStream(`${process.cwd()}/queue.class.log`),
})

type EventFunction = (msg: { [key: string]: string }) => Promise<any> | void

const idleForCallback = new IdleState()

class CoreClass<P extends ProviderClass, D extends MemoryDB> extends EventEmitter {
    flowClass: FlowClass
    database: D
    provider: P
    queuePrincipal: Queue<unknown>
    stateHandler = new SingleState()
    globalStateHandler = new GlobalState()
    dynamicBlacklist = new BlackList()
    generalArgs: GeneralArgs & { host?: string } = {
        blackList: [],
        listEvents: {},
        delay: 0,
        globalState: {},
        extensions: undefined,
        queue: {
            timeout: 20000,
            concurrencyLimit: 15,
        },
        host: undefined,
    }

    constructor(_flow: any, _database: D, _provider: P, _args: GeneralArgs) {
        super()
        this.flowClass = _flow
        this.database = _database
        this.provider = _provider
        this.generalArgs = { ...this.generalArgs, ..._args }

        this.dynamicBlacklist.add(this.generalArgs.blackList)

        this.queuePrincipal = new Queue(
            loggerQueue,
            this.generalArgs.queue.concurrencyLimit ?? 15,
            this.generalArgs.queue.timeout
        )

        this.globalStateHandler.updateState()(this.generalArgs.globalState)

        if (this.generalArgs.extensions) this.globalStateHandler.RAW = this.generalArgs.extensions

        for (const { event, func } of this.listenerBusEvents()) {
            this.provider.on(event, func)
        }
    }

    /**
     * Manejador de eventos
     */
    listenerBusEvents = (): { event: string; func: EventFunction }[] => [
        {
            event: 'preinit',
            func: () => printer('Iniciando proveedor, espere...'),
        },
        {
            event: 'require_action',
            func: ({ instructions, title = '⚡⚡ ACCIÓN REQUERIDA ⚡⚡' }) => printer(instructions, title),
        },
        {
            event: 'ready',
            func: () => printer('Proveedor conectado y listo'),
        },
        {
            event: 'auth_failure',
            func: ({ instructions }) => printer(instructions, '⚡⚡ ERROR AUTH ⚡⚡'),
        },
        {
            event: 'message',
            func: (msg: MessageContextIncoming) => {
                return this.handleMsg({ ...msg, host: `${this.generalArgs?.host}` })
            },
        },
        {
            event: 'host',
            func: (payload: { phone: string }) => this.setHostData(payload),
        },
    ]

    private setHostData = (hostNumber: { phone: string }) => {
        this.generalArgs.host = hostNumber.phone
    }

    handleMsg = async (messageCtxInComing: MessageContextIncoming) => {
        logger.log(`[handleMsg]: `, messageCtxInComing)
        idleForCallback.stop(messageCtxInComing)
        const { body, from } = messageCtxInComing
        let msgToSend = []
        let endFlowFlag = false
        const fallBackFlag = false
        if (this.dynamicBlacklist.checkIf(from)) return
        if (!body) return

        const prevMsg = await this.database.getPrevByNumber(from)
        const refToContinue = this.flowClass.findBySerialize(prevMsg?.refSerialize)

        if (prevMsg?.ref) {
            delete prevMsg._id
            const ctxByNumber = toCtx({
                body,
                from,
                prevRef: prevMsg.refSerialize,
            })
            await this.database.save(ctxByNumber)
        }

        // 📄 Mantener estado de conversacion por numero
        const state = {
            getMyState: this.stateHandler.getMyState(messageCtxInComing.from),
            get: this.stateHandler.get(messageCtxInComing.from),
            // getAllState: this.stateHandler.getAllState,
            update: this.stateHandler.updateState(messageCtxInComing),
            clear: this.stateHandler.clear(messageCtxInComing.from),
        }

        // 📄 Mantener estado global
        const globalState = {
            // getMyState: this.globalStateHandler.getMyState(),
            get: this.globalStateHandler.get(),
            getAllState: this.globalStateHandler.getAllState,
            update: this.globalStateHandler.updateState(),
            clear: this.globalStateHandler.clear(),
        }

        const extensions = this.globalStateHandler.RAW

        // 📄 Crar CTX de mensaje (uso private)
        const createCtxMessage = (
            payload: {
                body: any
                answer: any
                media: string
                buttons: any[]
                capture: boolean
                delay: number
                keyword: null
            },
            index = 0
        ) => {
            const body = typeof payload === 'string' ? payload : payload?.body ?? payload?.answer
            const media = payload?.media ?? null
            const buttons = payload?.buttons ?? []
            const capture = payload?.capture ?? false
            const delay = payload?.delay ?? 0
            const keyword = payload?.keyword ?? null

            return toCtx({
                body,
                from,
                keyword,
                index,
                options: { media, buttons, capture, delay },
            })
        }

        // 📄 Limpiar cola de procesos
        const clearQueue = () => {
            this.queuePrincipal.clearQueue(from)
            return
        }

        // 📄 Finalizar flujo
        const endFlow =
            (flag: { endFlow: any; fallBack?: boolean; flowDynamic?: boolean; gotoFlow?: boolean }) =>
            async (message = null) => {
                flag.endFlow = true
                endFlowFlag = true
                if (message) this.sendProviderAndSave(from, createCtxMessage(message))
                clearQueue()
                return
            }

        // 📄 Finalizar flujo (patch)
        const endFlowToGotoFlow =
            (flag: any) =>
            async (messages = null, options = { fromGotoFlow: false, end: false }) => {
                flag.endFlow = true
                endFlowFlag = true

                if (Array.isArray(messages)) {
                    for (const iteratorCtxMessage of messages) {
                        const scopeCtx: any = await resolveCbEveryCtx(iteratorCtxMessage, {
                            omitEndFlow: options.fromGotoFlow,
                            idleCtx: !!iteratorCtxMessage?.options?.idle,
                            triggerKey: iteratorCtxMessage.keyword.startsWith('key_'),
                        })
                        if (scopeCtx?.endFlow) break
                    }
                }
                clearQueue()
                return
            }

        // 📄 Esta funcion se encarga de enviar un array de mensajes dentro de este ctx
        const sendFlow = async (messageToSend: any[], numberOrId: string, options: { [key: string]: any } = {}) => {
            options = { prev: prevMsg, forceQueue: false, ...options }

            const idleCtxQueue = idleForCallback.get({ from, inRef: prevMsg?.ref })

            const { ref: prevRef, options: prevOptions } = options.prev || {}
            const { capture, idle } = prevOptions || {}

            if (messageCtxInComing?.ref && idleCtxQueue && messageToSend.length) {
                return
            }

            if (capture && idle && messageToSend.length === 0) {
                await cbEveryCtx(prevRef)
                return
            }

            if (capture && !idle) {
                await cbEveryCtx(prevRef)
            }

            for (const ctxMessage of messageToSend) {
                if (endFlowFlag) {
                    break
                }

                const delayMs = ctxMessage?.options?.delay ?? this.generalArgs.delay ?? 0
                await delay(delayMs)

                if (options.forceQueue) {
                    await handleForceQueue(ctxMessage, messageToSend, numberOrId, from)
                }

                await enqueueMsg(numberOrId, ctxMessage, from)
            }
        }

        // Se han extraído algunas funcionalidades en nuevas funciones para mejorar la legibilidad
        const handleForceQueue = async (_: any, messageToSend: any[], numberOrId: string, from: string) => {
            const listIdsRefCallbacks = messageToSend.map((i: { ref: string }) => i.ref)
            const listProcessWait = this.queuePrincipal.getIdsCallback(from)

            if (!listProcessWait.length) {
                this.queuePrincipal.setIdsCallbacks(from, listIdsRefCallbacks)
            } else {
                const lastMessage = messageToSend[messageToSend.length - 1]
                await this.database.save({ ...lastMessage, from: numberOrId })

                if (listProcessWait.includes(lastMessage.ref)) {
                    this.queuePrincipal.clearQueue(from)
                }
            }
        }

        const enqueueMsg = async (numberOrId: string, ctxMessage: { ref: any }, from: string) => {
            try {
                await this.queuePrincipal.enqueue(
                    from,
                    async () => {
                        await this.sendProviderAndSave(numberOrId, ctxMessage)
                            .then(() => resolveCbEveryCtx(ctxMessage))
                            .catch((error) => {
                                logger.error(`Error en sendProviderAndSave (ID ${ctxMessage.ref}):`, error)
                                throw error
                            })

                        logger.log(`[QUEUE_SE_ENVIO]: `, ctxMessage)
                    },
                    ctxMessage.ref
                )
            } catch (error) {
                logger.error(`Error al encolar (ID ${ctxMessage.ref}):`, error)
                throw error
            }
        }

        const continueFlow = async (initRef = undefined): Promise<any> => {
            try {
                const currentPrev = await this.database.getPrevByNumber(from)

                let nextFlow = this.flowClass.find(refToContinue?.ref, true) || []
                if (initRef && !initRef?.idleFallBack) {
                    nextFlow = this.flowClass.find(initRef?.ref, true) || []
                }

                const getContinueIndex = nextFlow.findIndex((msg) => msg.refSerialize === currentPrev?.refSerialize)
                const indexToContinue = getContinueIndex !== -1 ? getContinueIndex : 0
                const filterNextFlow = nextFlow
                    .slice(indexToContinue)
                    .filter((i) => i.refSerialize !== currentPrev?.refSerialize)

                const isContinueFlow = filterNextFlow.map((i) => i.keyword).includes(currentPrev?.ref)

                if (!isContinueFlow) {
                    const refToContinueChild = this.flowClass.getRefToContinueChild(currentPrev?.keyword)
                    const flowStandaloneChild = this.flowClass.getFlowsChild()
                    const nextChildMessages =
                        this.flowClass.find(refToContinueChild?.ref, true, flowStandaloneChild) || []

                    if (nextChildMessages.length) {
                        return exportFunctionsSend(() => sendFlow(nextChildMessages, from, { prev: undefined }))
                    }

                    return exportFunctionsSend(() => sendFlow(filterNextFlow, from, { prev: undefined }))
                }

                if (initRef && !initRef?.idleFallBack) {
                    return exportFunctionsSend(() => sendFlow(filterNextFlow, from, { prev: undefined }))
                }
            } catch (error) {
                // Manejar errores aquí según tu lógica de manejo de errores.
                console.error('Error en continueFlow:', error)
            }
        }
        // 📄 [options: fallBack]: esta funcion se encarga de repetir el ultimo mensaje
        const fallBack =
            (flag: { endFlow?: boolean; fallBack: any; flowDynamic?: boolean; gotoFlow?: boolean }) =>
            async (message = null) => {
                this.queuePrincipal.clearQueue(from)
                flag.fallBack = true
                await this.sendProviderAndSave(from, {
                    ...prevMsg,
                    answer: typeof message === 'string' ? message : message?.body ?? prevMsg.answer,
                    options: {
                        ...prevMsg.options,
                        buttons: prevMsg.options?.buttons,
                    },
                })
                return
            }

        const gotoFlow =
            (flag: { endFlow?: boolean; fallBack?: boolean; flowDynamic?: boolean; gotoFlow?: any }) =>
            async (flowInstance: { toJson: () => any; ctx: { options: { delay: any } } }, step = 0) => {
                idleForCallback.stop({ from })
                const promises = []
                flag.gotoFlow = true

                if (!flowInstance?.toJson) {
                    printer([
                        `[POSSIBLE_CIRCULAR_DEPENDENCY]: Se ha detectado una dependencia circular.`,
                        `Para evitar problemas, te recomendamos utilizar 'require'('./ruta_del_flow')`,
                        `Ejemplo:  gotoFlow(helloFlow) -->  gotoFlow(require('./flows/helloFlow.js'))`,
                        `[INFO]: https://bot-whatsapp.netlify.app/docs/goto-flow/`,
                    ])
                    return
                }

                await delay(flowInstance?.ctx?.options?.delay ?? 0)

                const flowTree = flowInstance.toJson()

                const flowParentId = flowTree[step]

                const parseListMsg = await this.flowClass.find(flowParentId?.ref, true, flowTree)

                for (const msg of parseListMsg) {
                    const msgParse = this.flowClass.findSerializeByRef(msg?.ref)

                    const ctxMessage = { ...msgParse, ...msg }
                    await this.sendProviderAndSave(from, ctxMessage).then(() => promises.push(ctxMessage))
                }

                await endFlowToGotoFlow(flag)(promises, { fromGotoFlow: true, ...{ end: endFlowFlag } })
                return
            }

        // 📄 [options: flowDynamic]: esta funcion se encarga de responder un array de respuesta esta limitado a 5 mensajes
        // para evitar bloque de whatsapp

        const flowDynamic =
            (
                flag: { endFlow?: boolean; fallBack?: boolean; flowDynamic: any; gotoFlow?: boolean },
                inRef: any,
                privateOptions: { [x: string]: any; omitEndFlow?: any; idleCtx?: any }
            ) =>
            async (listMessages: string | string[] | FlowDynamicMessage[] = [], options = { continue: true }) => {
                if (!options.hasOwnProperty('continue')) {
                    options = { ...options, continue: true }
                }

                flag.flowDynamic = true

                if (!Array.isArray(listMessages)) {
                    listMessages = [{ body: listMessages, ...options }]
                }

                const parseListMsg = listMessages.map((opt: FlowDynamicMessage, index: number) => {
                    const optParse = {
                        body: opt?.body ?? ' ',
                        media: opt?.media ?? null,
                        buttons: opt?.buttons ?? [],
                        capture: false,
                        delay: opt?.delay ?? this.generalArgs.delay ?? 0,
                        keyword: null,
                        answer: undefined,
                    }

                    return createCtxMessage(optParse, index)
                })

                // Si endFlowFlag existe y no se omite la finalización del flujo, no hacer nada.
                if (endFlowFlag && !privateOptions?.omitEndFlow) {
                    return
                }

                this.queuePrincipal.setFingerTime(from, inRef)

                for (const msg of parseListMsg) {
                    if (privateOptions?.idleCtx) {
                        continue // Saltar al siguiente mensaje si se está en modo idleCtx.
                    }

                    const delayMs = msg?.options?.delay ?? this.generalArgs.delay ?? 0
                    await delay(delayMs)
                    await this.sendProviderAndSave(from, msg)
                }

                if (options?.continue) {
                    await continueFlow()
                    return
                }
                return
            }

        // 📄 Se encarga de revisar si el contexto del mensaje tiene callback o idle
        const resolveCbEveryCtx = async (
            ctxMessage: any,
            options = { omitEndFlow: false, idleCtx: false, triggerKey: false }
        ) => {
            if (!!ctxMessage?.options?.idle && !ctxMessage?.options?.capture) {
                printer(
                    `[ATENCION IDLE]: La función "idle" no tendrá efecto a menos que habilites la opción "capture:true". Por favor, asegúrate de configurar "capture:true" o elimina la función "idle"`
                )
                return
            }

            if (ctxMessage?.options?.idle) {
                const run = await cbEveryCtx(ctxMessage?.ref, { ...options, startIdleMs: ctxMessage?.options?.idle })
                return run
            }
            if (!ctxMessage?.options?.capture) {
                const run = await cbEveryCtx(ctxMessage?.ref, options)
                return run
            }
        }

        // 📄 Se encarga de revisar si el contexto del mensaje tiene callback y ejecutarlo
        const cbEveryCtx = async (
            inRef: string | number,
            options: { [key: string]: any } = { startIdleMs: 0, omitEndFlow: false, idleCtx: false, triggerKey: false }
        ) => {
            const flags = {
                endFlow: false,
                fallBack: false,
                flowDynamic: false,
                gotoFlow: false,
            }

            const provider = this.provider
            const database = this.database

            if (!this.flowClass.allCallbacks[inRef]) return Promise.resolve()

            /** argumentos que se exponen */
            const argsCb = {
                database,
                provider,
                state,
                globalState,
                extensions,
                blacklist: this.dynamicBlacklist,
                queue: this.queuePrincipal,
                idle: idleForCallback,
                inRef,
                fallBack: fallBack(flags),
                flowDynamic: flowDynamic(flags, inRef, options),
                endFlow: endFlow(flags),
                gotoFlow: gotoFlow(flags),
            }

            const runContext = async (continueAfterIdle = false, overCtx: any = {}) => {
                try {
                    messageCtxInComing = { ...messageCtxInComing, ...overCtx }

                    if (options?.idleCtx && !options?.triggerKey) {
                        return
                    }

                    await this.flowClass.allCallbacks[inRef](messageCtxInComing, argsCb)
                    //Si no hay llamado de fallaback y no hay llamado de flowDynamic y no hay llamado de enflow EL flujo continua
                    if (continueAfterIdle) {
                        idleForCallback.stop({ from })
                        await continueFlow(overCtx)
                        return
                    }
                    const ifContinue = !flags.endFlow && !flags.fallBack && !flags.flowDynamic
                    if (ifContinue) {
                        idleForCallback.stop({ from })
                        await continueFlow()
                        return
                    }
                } catch (error) {
                    return Promise.reject(error)
                }
            }

            if (options.startIdleMs > 0) {
                idleForCallback.setIdleTime({
                    from,
                    inRef,
                    timeInSeconds: options.startIdleMs / 1000,
                    cb: async (opts: any) => {
                        if (opts.next) {
                            await runContext(true, { idleFallBack: opts.next, ref: opts.inRef, body: opts.body })
                        }
                    },
                })
                return
            }

            await runContext()
            return { ...flags }
        }

        const exportFunctionsSend = async (cb = () => Promise.resolve()) => {
            await cb()
            return {
                createCtxMessage,
                clearQueue,
                endFlow,
                sendFlow,
                continueFlow,
                fallBack,
                gotoFlow,
                flowDynamic,
                resolveCbEveryCtx,
                cbEveryCtx,
            }
        }

        // 📄🤘(tiene return) [options: nested(array)]: Si se tiene flujos hijos los implementa
        if (!endFlowFlag && prevMsg?.options?.nested?.length) {
            const nestedRef = prevMsg.options.nested
            const flowStandalone = nestedRef.map((f: { refSerialize: string }) => ({
                ...nestedRef.find((r: { refSerialize: string }) => r.refSerialize === f.refSerialize),
            }))

            msgToSend = this.flowClass.find(body, false, flowStandalone) || []
            return exportFunctionsSend(() => sendFlow(msgToSend, from))
        }

        // 📄🤘(tiene return) Si el mensaje previo implementa capture
        if (!endFlowFlag && !prevMsg?.options?.nested?.length) {
            const typeCapture = typeof prevMsg?.options?.capture

            if (typeCapture === 'boolean' && fallBackFlag) {
                msgToSend = this.flowClass.find(refToContinue?.ref, true) || []
                return exportFunctionsSend(() => sendFlow(msgToSend, from, { forceQueue: true }))
            }
        }

        msgToSend = this.flowClass.find(body) || []

        if (msgToSend.length) {
            return exportFunctionsSend(() => sendFlow(msgToSend, from))
        }

        if (!prevMsg?.options?.capture) {
            msgToSend = this.flowClass.find(this.generalArgs.listEvents.WELCOME) || []

            if (LIST_REGEX.REGEX_EVENT_LOCATION.test(body)) {
                msgToSend = this.flowClass.find(this.generalArgs.listEvents.LOCATION) || []
            }

            if (LIST_REGEX.REGEX_EVENT_MEDIA.test(body)) {
                msgToSend = this.flowClass.find(this.generalArgs.listEvents.MEDIA) || []
            }

            if (LIST_REGEX.REGEX_EVENT_DOCUMENT.test(body)) {
                msgToSend = this.flowClass.find(this.generalArgs.listEvents.DOCUMENT) || []
            }

            if (LIST_REGEX.REGEX_EVENT_VOICE_NOTE.test(body)) {
                msgToSend = this.flowClass.find(this.generalArgs.listEvents.VOICE_NOTE) || []
            }

            if (LIST_REGEX.REGEX_EVENT_ORDER.test(body)) {
                msgToSend = this.flowClass.find(this.generalArgs.listEvents.ORDER) || []
            }

            if (LIST_REGEX.REGEX_EVENT_TEMPLATE.test(body)) {
                msgToSend = this.flowClass.find(this.generalArgs.listEvents.TEMPLATE) || []
            }
        }

        return exportFunctionsSend(() => sendFlow(msgToSend, from, { forceQueue: true }))
    }

    /**
     * Enviar mensaje con contexto atraves del proveedor de whatsapp
     * @param {*} numberOrId
     * @param {*} ctxMessage ver más en GLOSSARY.md
     * @returns
     */
    sendProviderAndSave = async (numberOrId: string, ctxMessage: any) => {
        try {
            const { answer } = ctxMessage
            if (answer && answer.length && answer !== '__call_action__' && answer !== '__goto_flow__') {
                if (answer !== '__capture_only_intended__') {
                    await this.provider.sendMessage(numberOrId, answer, ctxMessage)
                    this.emit('send_message', { numberOrId, answer, ctxMessage })
                }
            }
            await this.database.save({ ...ctxMessage, from: numberOrId })

            return Promise.resolve()
        } catch (err) {
            logger.log(`[ERROR ID (${ctxMessage.ref})]: `, err)
            return Promise.reject()
        }
    }

    /**
     * Funcion dedicada a enviar el mensaje sin pasar por el flow
     * (dialogflow)
     * @param {*} messageToSend
     * @param {*} numberOrId
     * @returns
     */
    sendFlowSimple = async (messageToSend: any, numberOrId: any) => {
        for (const ctxMessage of messageToSend) {
            const delayMs = ctxMessage?.options?.delay ?? this.generalArgs.delay ?? 0
            await delay(delayMs)
            await this.queuePrincipal.enqueue(
                numberOrId,
                () => this.sendProviderAndSave(numberOrId, ctxMessage),
                ctxMessage.ref
            )
            // await queuePromises.dequeue()
        }
        return Promise.resolve
    }

    /**
     *
     */
    httpServer = (port: number) => {
        this.provider.initHttpServer(port, {
            blacklist: this.dynamicBlacklist,
        })
    }

    /**
     *
     * @param ctxPolka
     * @returns
     */
    handleCtx = (
        ctxPolka: (
            bot:
                | (Pick<typeof this.provider, 'sendMessage' | 'vendor'> & {
                      provider: typeof this.provider
                      blacklist: DynamicBlacklist
                      dispatch: DispatchFn
                  })
                | undefined,
            req: any,
            res: any
        ) => Promise<void>
    ) => this.provider.inHandleCtx(ctxPolka)
}
export { CoreClass }
