const { toCtx } = require('../io/methods')
const { printer } = require('../utils/interactive')
const { delay } = require('../utils/delay')
const Queue = require('../utils/queue')
const { Console } = require('console')
const { createWriteStream } = require('fs')

const logger = new Console({
    stdout: createWriteStream(`${process.cwd()}/core.class.log`),
})

const QueuePrincipal = new Queue()

/**
 * [ ] Escuchar eventos del provider asegurarte que los provider emitan eventos
 * [ ] Guardar historial en db
 * [ ] Buscar mensaje en flow
 *
 */
class CoreClass {
    flowClass
    databaseClass
    providerClass
    generalArgs = { blackList: [] }
    constructor(_flow, _database, _provider, _args) {
        this.flowClass = _flow
        this.databaseClass = _database
        this.providerClass = _provider
        this.generalArgs = { ...this.generalArgs, ..._args }

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
        if (!body.length) return

        let prevMsg = await this.databaseClass.getPrevByNumber(from)
        const refToContinue = this.flowClass.findBySerialize(prevMsg?.refSerialize)

        if (prevMsg?.ref) {
            const ctxByNumber = toCtx({
                body,
                from,
                prevRef: prevMsg.refSerialize,
            })
            await this.databaseClass.save(ctxByNumber)
        }

        // 📄 Crar CTX de mensaje (uso private)
        const createCtxMessage = (payload = {}, index = 0) => {
            const body = typeof payload === 'string' ? payload : payload?.body ?? payload?.answer
            const media = payload?.media ?? null
            const buttons = payload?.buttons ?? []
            const capture = payload?.capture ?? false

            return toCtx({
                body,
                from,
                keyword: null,
                index,
                options: { media, buttons, capture },
            })
        }

        // 📄 Limpiar cola de procesos
        const clearQueue = () => {
            QueuePrincipal.pendingPromise = false
            QueuePrincipal.queue = []
        }

        // 📄 Finalizar flujo
        const endFlow =
            (flag) =>
            async (message = null) => {
                flag.endFlow = true
                endFlowFlag = true
                if (message) this.sendProviderAndSave(from, createCtxMessage(message))
                clearQueue()
                sendFlow([])
                return
            }

        // 📄 Esta funcion se encarga de enviar un array de mensajes dentro de este ctx
        const sendFlow = async (messageToSend, numberOrId, options = { prev: prevMsg }) => {
            if (options.prev?.options?.capture) await cbEveryCtx(options.prev?.ref)

            const queue = []
            for (const ctxMessage of messageToSend) {
                if (endFlowFlag) return
                const delayMs = ctxMessage?.options?.delay || 0
                if (delayMs) await delay(delayMs)
                await QueuePrincipal.enqueue(() =>
                    this.sendProviderAndSave(numberOrId, ctxMessage).then(() => resolveCbEveryCtx(ctxMessage))
                )
            }
            return Promise.all(queue)
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
                if (nextChildMessages?.length) return await sendFlow(nextChildMessages, from, { prev: undefined })
            }

            if (!isContinueFlow) {
                await sendFlow(filterNextFlow, from, { prev: undefined })
                return
            }
        }
        // 📄 [options: fallBack]: esta funcion se encarga de repetir el ultimo mensaje
        const fallBack =
            (flag) =>
            async (message = null) => {
                QueuePrincipal.queue = []
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

        // 📄 [options: flowDynamic]: esta funcion se encarga de responder un array de respuesta esta limitado a 5 mensajes
        // para evitar bloque de whatsapp

        const flowDynamic =
            (flag) =>
            async (listMsg = []) => {
                flag.flowDynamic = true
                if (!Array.isArray(listMsg)) listMsg = [listMsg]

                const parseListMsg = listMsg.map((opt, index) => createCtxMessage(opt, index))

                if (endFlowFlag) return
                for (const msg of parseListMsg) {
                    await this.sendProviderAndSave(from, msg)
                }
                await continueFlow()
                return
            }

        // 📄 Se encarga de revisar si el contexto del mensaje tiene callback o fallback
        const resolveCbEveryCtx = async (ctxMessage) => {
            if (!ctxMessage?.options?.capture) return await cbEveryCtx(ctxMessage?.ref)
        }

        // 📄 Se encarga de revisar si el contexto del mensaje tiene callback y ejecutarlo
        const cbEveryCtx = async (inRef) => {
            let flags = {
                endFlow: false,
                fallBack: false,
                flowDynamic: false,
                wait: true,
            }

            const provider = this.providerClass

            if (!this.flowClass.allCallbacks[inRef]) return Promise.resolve()

            const argsCb = {
                provider,
                fallBack: fallBack(flags),
                flowDynamic: flowDynamic(flags),
                endFlow: endFlow(flags),
            }

            await this.flowClass.allCallbacks[inRef](messageCtxInComming, argsCb)
            const wait = !(!flags.endFlow && !flags.fallBack && !flags.flowDynamic)
            if (!wait) await continueFlow()

            return
        }

        // 📄🤘(tiene return) [options: nested(array)]: Si se tiene flujos hijos los implementa
        if (!endFlowFlag && prevMsg?.options?.nested?.length) {
            const nestedRef = prevMsg.options.nested
            const flowStandalone = nestedRef.map((f) => ({
                ...nestedRef.find((r) => r.refSerialize === f.refSerialize),
            }))

            msgToSend = this.flowClass.find(body, false, flowStandalone) || []

            await sendFlow(msgToSend, from)
            return
        }

        // 📄🤘(tiene return) Si el mensaje previo implementa capture
        if (!endFlowFlag && !prevMsg?.options?.nested?.length) {
            const typeCapture = typeof prevMsg?.options?.capture

            if (typeCapture === 'boolean' && fallBackFlag) {
                msgToSend = this.flowClass.find(refToContinue?.ref, true) || []
                await sendFlow(msgToSend, from)
                return
            }
        }

        msgToSend = this.flowClass.find(body) || []
        sendFlow(msgToSend, from)
    }

    /**
     * Enviar mensaje con contexto atraves del proveedor de whatsapp
     * @param {*} numberOrId
     * @param {*} ctxMessage ver más en GLOSSARY.md
     * @returns
     */
    sendProviderAndSave = async (numberOrId, ctxMessage) => {
        const { answer } = ctxMessage
        await this.providerClass.sendMessage(numberOrId, answer, ctxMessage)
        await this.databaseClass.save({ ...ctxMessage, from: numberOrId })
        return
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
        const queue = []
        for (const ctxMessage of messageToSend) {
            const delayMs = ctxMessage?.options?.delay || 0
            if (delayMs) await delay(delayMs)
            QueuePrincipal.enqueue(() => this.sendProviderAndSave(numberOrId, ctxMessage))
        }
        return Promise.all(queue)
    }
}
module.exports = CoreClass
