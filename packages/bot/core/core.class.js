const { EventEmitter } = require('node:events')
const { toCtx } = require('../io/methods')
const { printer } = require('../utils/interactive')
const { delay } = require('../utils/delay')
const { Console } = require('console')
const { createWriteStream } = require('fs')
const Queue = require('../utils/queue')

const { LIST_REGEX } = require('../io/events')
const SingleState = require('../context/state.class')
const GlobalState = require('../context/globalState.class')
const { generateTime } = require('../utils/hash')
const IdleState = require('../context/idleState.class')

const logger = new Console({
    stdout: createWriteStream(`${process.cwd()}/core.class.log`),
})
const loggerQueue = new Console({
    stdout: createWriteStream(`${process.cwd()}/queue.class.log`),
})

const idleForCallback = new IdleState()

/**
 * [ ] Escuchar eventos del provider asegurarte que los provider emitan eventos
 * [ ] Guardar historial en db
 * [ ] Buscar mensaje en flow
 *
 */
class CoreClass extends EventEmitter {
    flowClass
    databaseClass
    providerClass
    queuePrincipal
    stateHandler = new SingleState()
    globalStateHandler = new GlobalState()
    generalArgs = {
        blackList: [],
        listEvents: {},
        delay: 0,
        globalState: {},
        extensions: undefined,
        queue: {
            timeout: 20000,
            concurrencyLimit: 15,
        },
    }
    constructor(_flow, _database, _provider, _args) {
        super()
        this.flowClass = _flow
        this.databaseClass = _database
        this.providerClass = _provider
        this.generalArgs = { ...this.generalArgs, ..._args }

        this.queuePrincipal = new Queue(
            loggerQueue,
            this.generalArgs.queue.concurrencyLimit,
            this.generalArgs.queue.timeout
        )

        this.globalStateHandler.updateState()(this.generalArgs.globalState)

        if (this.generalArgs.extensions) this.globalStateHandler.RAW = this.generalArgs.extensions

        for (const { event, func } of this.listenerBusEvents()) {
            this.providerClass.on(event, func)
        }
    }

    /**
     * Manejador de eventos
     */
    listenerBusEvents = () => [
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
            func: (msg) => this.handleMsg(msg),
        },
        {
            event: 'notice',
            func: (note) => printer(note),
        },
    ]

    /**
     * GLOSSARY.md
     * @param {*} messageCtxInComming
     * @returns
     */
    handleMsg = async (messageCtxInComming) => {
        logger.log(`[handleMsg]: `, messageCtxInComming)
        const { body, from } = messageCtxInComming
        let msgToSend = []
        let endFlowFlag = false
        let fallBackFlag = false
        if (this.generalArgs.blackList.includes(from)) return
        if (!body) return

        let prevMsg = await this.databaseClass.getPrevByNumber(from)
        const refToContinue = this.flowClass.findBySerialize(prevMsg?.refSerialize)

        if (prevMsg?.ref) {
            delete prevMsg._id
            const ctxByNumber = toCtx({
                body,
                from,
                prevRef: prevMsg.refSerialize,
            })
            await this.databaseClass.save(ctxByNumber)
        }

        // 📄 Mantener estado de conversacion por numero
        const state = {
            getMyState: this.stateHandler.getMyState(messageCtxInComming.from),
            get: this.stateHandler.get(messageCtxInComming.from),
            getAllState: this.stateHandler.getAllState,
            update: this.stateHandler.updateState(messageCtxInComming),
            clear: this.stateHandler.clear(messageCtxInComming.from),
        }

        // 📄 Mantener estado global
        const globalState = {
            getMyState: this.globalStateHandler.getMyState(),
            get: this.globalStateHandler.get(),
            getAllState: this.globalStateHandler.getAllState,
            update: this.globalStateHandler.updateState(messageCtxInComming),
            clear: this.globalStateHandler.clear(),
        }

        const extensions = this.globalStateHandler.RAW

        // 📄 Crar CTX de mensaje (uso private)
        const createCtxMessage = (payload = {}, index = 0) => {
            const body = typeof payload === 'string' ? payload : payload?.body ?? payload?.answer
            const media = payload?.media ?? null
            const buttons = payload?.buttons ?? []
            const capture = payload?.capture ?? false
            const delay = payload?.delay ?? 0

            return toCtx({
                body,
                from,
                keyword: null,
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
            (flag) =>
            async (message = null) => {
                flag.endFlow = true
                endFlowFlag = true
                if (message) this.sendProviderAndSave(from, createCtxMessage(message))
                clearQueue()
                return
            }

        // 📄 Esta funcion se encarga de enviar un array de mensajes dentro de este ctx
        const sendFlow = async (messageToSend, numberOrId, options = {}) => {
            options = { prev: prevMsg, forceQueue: false, ...options }

            if (options.prev?.options?.capture) {
                await cbEveryCtx(options.prev?.ref)
            }

            for (const ctxMessage of messageToSend) {
                if (endFlowFlag) {
                    return // Si endFlowFlag es verdadero, detener el flujo
                }

                const delayMs = ctxMessage?.options?.delay ?? this.generalArgs.delay ?? 0
                if (delayMs) {
                    await delay(delayMs) // Esperar según el retraso configurado
                }

                //TODO el proceso de forzar cola de procsos
                if (options?.forceQueue) {
                    const listIdsRefCallbacks = messageToSend.map((i) => i.ref)

                    const listProcessWait = this.queuePrincipal.getIdsCallbacs(from)
                    if (!listProcessWait.length) {
                        this.queuePrincipal.setIdsCallbacks(from, listIdsRefCallbacks)
                    } else {
                        const lastMessage = messageToSend[messageToSend.length - 1]
                        await this.databaseClass.save({ ...lastMessage, from: numberOrId })
                        if (listProcessWait.includes(lastMessage.ref)) {
                            this.queuePrincipal.clearQueue(from)
                        }
                    }
                }

                try {
                    await this.queuePrincipal.enqueue(
                        from,
                        async () => {
                            // Usar async en la función pasada a enqueue
                            await this.sendProviderAndSave(numberOrId, ctxMessage)
                            logger.log(`[QUEUE_SE_ENVIO]: `, ctxMessage)
                            await resolveCbEveryCtx(ctxMessage)
                        },
                        ctxMessage.ref
                    )
                } catch (error) {
                    logger.error(`Error al encolar (ID ${ctxMessage.ref}):`, error)
                    return Promise.reject
                    // Puedes considerar manejar el error aquí o rechazar la promesa
                    // Pasada a resolveCbEveryCtx con el error correspondiente.
                }
            }
        }

        const continueFlow = async () => {
            const currentPrev = await this.databaseClass.getPrevByNumber(from)
            const nextFlow = (await this.flowClass.find(refToContinue?.ref, true)) ?? []
            const filterNextFlow = nextFlow.filter((msg) => msg.refSerialize !== currentPrev?.refSerialize)
            const isContinueFlow = filterNextFlow.map((i) => i.keyword).includes(currentPrev?.ref)

            if (!isContinueFlow) {
                const refToContinueChild = this.flowClass.getRefToContinueChild(currentPrev?.keyword)
                const flowStandaloneChild = this.flowClass.getFlowsChild()
                const nextChildMessages =
                    (await this.flowClass.find(refToContinueChild?.ref, true, flowStandaloneChild)) || []
                if (nextChildMessages?.length)
                    return exportFunctionsSend(() => sendFlow(nextChildMessages, from, { prev: undefined }))

                return exportFunctionsSend(() => sendFlow(filterNextFlow, from, { prev: undefined }))
            }
        }
        // 📄 [options: fallBack]: esta funcion se encarga de repetir el ultimo mensaje
        const fallBack =
            (flag) =>
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
            (flag) =>
            async (flowInstance, step = 0) => {
                flag.gotoFlow = true
                const flowTree = flowInstance.toJson()
                const flowParentId = flowTree[step]
                const parseListMsg = await this.flowClass.find(flowParentId?.ref, true, flowTree)
                if (endFlowFlag) return
                for (const msg of parseListMsg) {
                    const msgParse = this.flowClass.findSerializeByRef(msg?.ref)
                    const ctxMessage = { ...msgParse, ...msg }
                    await this.sendProviderAndSave(from, ctxMessage).then(() => resolveCbEveryCtx(ctxMessage))
                }
                await endFlow(flag)()
                return
            }

        // 📄 [options: flowDynamic]: esta funcion se encarga de responder un array de respuesta esta limitado a 5 mensajes
        // para evitar bloque de whatsapp

        const flowDynamic =
            (flag) =>
            async (listMsg = [], options = { continue: true }) => {
                if (!options.hasOwnProperty('continue')) options = { ...options, continue: true }

                flag.flowDynamic = true
                if (!Array.isArray(listMsg)) listMsg = [{ body: listMsg, ...options }]
                const parseListMsg = listMsg.map((opt, index) => createCtxMessage(opt, index))

                if (endFlowFlag) return
                this.queuePrincipal.setFingerTime(from, generateTime()) //aqui debeo decirle al sistema como que finalizo el flujo
                for (const msg of parseListMsg) {
                    const delayMs = msg?.options?.delay ?? this.generalArgs.delay ?? 0
                    if (delayMs) await delay(delayMs)
                    await this.sendProviderAndSave(from, msg)
                }

                if (options?.continue) await continueFlow(generateTime())
                return
            }

        // 📄 Se encarga de revisar si el contexto del mensaje tiene callback o idle
        const resolveCbEveryCtx = async (ctxMessage) => {
            if (!!ctxMessage?.options?.idle && !ctxMessage?.options?.capture) {
                printer(
                    `[ATENCION IDLE]: La función "idle" no tendrá efecto a menos que habilites la opción "capture:true". Por favor, asegúrate de configurar "capture:true" o elimina la función "idle"`
                )
            }
            if (ctxMessage?.options?.idle) return await cbEveryCtx(ctxMessage?.ref, ctxMessage?.options?.idle)
            if (!ctxMessage?.options?.capture) return await cbEveryCtx(ctxMessage?.ref)
        }

        // 📄 Se encarga de revisar si el contexto del mensaje tiene callback y ejecutarlo
        const cbEveryCtx = async (inRef, startIdleMs = 0) => {
            let flags = {
                endFlow: false,
                fallBack: false,
                flowDynamic: false,
                gotoFlow: false,
            }

            const provider = this.providerClass
            const database = this.databaseClass

            if (!this.flowClass.allCallbacks[inRef]) return Promise.resolve()
            const argsCb = {
                database,
                provider,
                state,
                globalState,
                extensions,
                idle: idleForCallback,
                inRef,
                fallBack: fallBack(flags),
                flowDynamic: flowDynamic(flags),
                endFlow: endFlow(flags),
                gotoFlow: gotoFlow(flags),
            }

            idleForCallback.stop(inRef)
            const runContext = async (continueAfterIdle = true, overCtx = {}) => {
                messageCtxInComming = { ...messageCtxInComming, ...overCtx }
                await this.flowClass.allCallbacks[inRef](messageCtxInComming, argsCb)
                //Si no hay llamado de fallaback y no hay llamado de flowDynamic y no hay llamado de enflow EL flujo continua
                const ifContinue = !flags.endFlow && !flags.fallBack && !flags.flowDynamic
                if (ifContinue && continueAfterIdle) await continueFlow(prevMsg?.options?.nested?.length)
            }

            if (startIdleMs > 0) {
                idleForCallback.setIdleTime(inRef, startIdleMs / 1000)
                idleForCallback.start(inRef, async () => {
                    await runContext(false, { idleFallBack: !!startIdleMs, from: null, body: null })
                })
                return
            }

            await runContext()
            return
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
            const flowStandalone = nestedRef.map((f) => ({
                ...nestedRef.find((r) => r.refSerialize === f.refSerialize),
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
        }
        return exportFunctionsSend(() => sendFlow(msgToSend, from, { forceQueue: true }))
    }

    /**
     * Enviar mensaje con contexto atraves del proveedor de whatsapp
     * @param {*} numberOrId
     * @param {*} ctxMessage ver más en GLOSSARY.md
     * @returns
     */
    sendProviderAndSave = async (numberOrId, ctxMessage) => {
        try {
            const { answer } = ctxMessage
            if (answer && answer.length && answer !== '__call_action__') {
                if (answer !== '__capture_only_intended__') {
                    await this.providerClass.sendMessage(numberOrId, answer, ctxMessage)
                    this.emit('send_message', { numberOrId, answer, ctxMessage })
                }
            }
            await this.databaseClass.save({ ...ctxMessage, from: numberOrId })

            return Promise.resolve
        } catch (err) {
            logger.log(`[ERROR ID (${ctxMessage.ref})]: `, err)
            return Promise.reject
        }
    }

    /**
     * @deprecated
     * @private
     * @param {*} message
     * @param {*} ref
     */
    continue = (message, ref = false) => {
        const responde = this.flowClass.find(message, ref)
        if (responde) {
            this.providerClass.sendMessage(responde.answer)
            this.databaseClass.saveLog(responde.answer)
            this.continue(null, responde.ref)
        }
    }

    /**
     * Funcion dedicada a enviar el mensaje sin pasar por el flow
     * (dialogflow)
     * @param {*} messageToSend
     * @param {*} numberOrId
     * @returns
     */
    sendFlowSimple = async (messageToSend, numberOrId) => {
        for (const ctxMessage of messageToSend) {
            const delayMs = ctxMessage?.options?.delay ?? this.generalArgs.delay ?? 0
            if (delayMs) await delay(delayMs)
            await this.queuePrincipal.enqueue(
                numberOrId,
                () => this.sendProviderAndSave(numberOrId, ctxMessage),
                ctxMessage.ref
            )
            // await queuePromises.dequeue()
        }
        return Promise.resolve
    }
}
module.exports = CoreClass
