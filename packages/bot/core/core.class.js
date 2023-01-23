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
            func: ({ instructions, title = '⚡⚡ ACCIÓN REQUERIDA ⚡⚡' }) =>
                printer(instructions, title),
        },
        {
            event: 'ready',
            func: () => printer('Proveedor conectado y listo'),
        },
        {
            event: 'auth_failure',
            func: ({ instructions }) =>
                printer(instructions, '⚡⚡ ERROR AUTH ⚡⚡'),
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
        let fallBackFlag = false
        let endFlowFlag = false
        if (this.generalArgs.blackList.includes(from)) return
        if (!body) return
        if (!body.length) return

        let prevMsg = await this.databaseClass.getPrevByNumber(from)
        const refToContinue = this.flowClass.findBySerialize(
            prevMsg?.refSerialize
        )

        if (prevMsg?.ref) {
            const ctxByNumber = toCtx({
                body,
                from,
                prevRef: prevMsg.refSerialize,
            })
            this.databaseClass.save(ctxByNumber)
        }

        // 📄 Limpiar cola de procesos
        const clearQueue = () => {
            QueuePrincipal.pendingPromise = false
            QueuePrincipal.queue = []
        }

        // 📄 Finalizar flujo
        const endFlow = async () => {
            prevMsg = null
            endFlowFlag = true
            clearQueue()
            return
        }

        // 📄 Esta funcion se encarga de enviar un array de mensajes dentro de este ctx
        const sendFlow = async (messageToSend, numberOrId) => {
            // [1 Paso] esto esta bien!

            if (prevMsg?.options?.capture) await cbEveryCtx(prevMsg?.ref)
            const queue = []
            for (const ctxMessage of messageToSend) {
                if (endFlowFlag) return
                const delayMs = ctxMessage?.options?.delay || 0
                if (delayMs) await delay(delayMs)
                QueuePrincipal.enqueue(() =>
                    Promise.all([
                        this.sendProviderAndSave(numberOrId, ctxMessage).then(
                            () => resolveCbEveryCtx(ctxMessage)
                        ),
                    ])
                )
            }
            return Promise.all(queue)
        }

        // 📄 [options: fallBack]: esta funcion se encarga de repetir el ultimo mensaje
        const fallBack = async () => {
            fallBackFlag = true
            await this.sendProviderAndSave(from, refToContinue)
            QueuePrincipal.queue = []
            return refToContinue
        }

        // 📄 [options: flowDynamic]: esta funcion se encarga de responder un array de respuesta esta limitado a 5 mensajes
        // para evitar bloque de whatsapp

        const flowDynamic = async (
            listMsg = [],
            optListMsg = { limit: 5, fallback: false }
        ) => {
            if (!Array.isArray(listMsg))
                throw new Error('Esto debe ser un ARRAY')

            fallBackFlag = optListMsg.fallback
            const parseListMsg = listMsg
                .map((opt, index) => {
                    const body = typeof opt === 'string' ? opt : opt.body
                    const media = opt?.media ?? null
                    const buttons = opt?.buttons ?? []

                    return toCtx({
                        body,
                        from,
                        keyword: null,
                        index,
                        options: { media, buttons },
                    })
                })
                .slice(0, optListMsg.limit)

            if (endFlowFlag) return
            for (const msg of parseListMsg) {
                await this.sendProviderAndSave(from, msg)
            }
            return
        }

        // 📄 Se encarga de revisar si el contexto del mensaje tiene callback o fallback
        const resolveCbEveryCtx = async (ctxMessage) => {
            if (!ctxMessage?.options?.capture)
                return await cbEveryCtx(ctxMessage?.ref)
        }

        // 📄 Se encarga de revisar si el contexto del mensaje tiene callback y ejecutarlo
        const cbEveryCtx = async (inRef) => {
            if (!this.flowClass.allCallbacks[inRef]) return Promise.resolve()
            return this.flowClass.allCallbacks[inRef](messageCtxInComming, {
                fallBack,
                flowDynamic,
                endFlow,
            })
        }

        // 📄🤘(tiene return) [options: nested(array)]: Si se tiene flujos hijos los implementa
        if (!fallBackFlag && prevMsg?.options?.nested?.length) {
            const nestedRef = prevMsg.options.nested
            const flowStandalone = nestedRef.map((f) => ({
                ...nestedRef.find((r) => r.refSerialize === f.refSerialize),
            }))

            msgToSend = this.flowClass.find(body, false, flowStandalone) || []

            sendFlow(msgToSend, from)
            return
        }

        // 📄🤘(tiene return) [options: capture (boolean)]: Si se tiene option boolean
        if (!fallBackFlag && !prevMsg?.options?.nested?.length) {
            const typeCapture = typeof prevMsg?.options?.capture
            const valueCapture = prevMsg?.options?.capture

            if (['string', 'boolean'].includes(typeCapture) && valueCapture) {
                msgToSend = this.flowClass.find(refToContinue?.ref, true) || []
                sendFlow(msgToSend, from)
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
    sendProviderAndSave = (numberOrId, ctxMessage) => {
        const { answer } = ctxMessage
        return Promise.all([
            this.providerClass.sendMessage(numberOrId, answer, ctxMessage),
            this.databaseClass.save({ ...ctxMessage, from: numberOrId }),
        ])
    }

    /**
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
            QueuePrincipal.enqueue(() =>
                this.sendProviderAndSave(numberOrId, ctxMessage)
            )
        }
        return Promise.all(queue)
    }
}
module.exports = CoreClass
