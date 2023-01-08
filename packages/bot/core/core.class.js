const { toCtx } = require('../io/methods')
const { printer } = require('../utils/interactive')
const { delay } = require('../utils/delay')
const Queue = require('../utils/queue')
const { Console } = require('console')
const { createWriteStream } = require('fs')

const logger = new Console({
    stdout: createWriteStream(`${process.cwd()}/core.class.log`),
})
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
    constructor(_flow, _database, _provider) {
        this.flowClass = _flow
        this.databaseClass = _database
        this.providerClass = _provider

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

        if (!body.length) return

        const prevMsg = await this.databaseClass.getPrevByNumber(from)
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

        // 📄 [options: fallBack]: esta funcion se encarga de repetir el ultimo mensaje
        const fallBack = () => {
            fallBackFlag = true
            msgToSend = this.flowClass.find(refToContinue?.keyword, true) || []
            this.sendFlow(msgToSend, from)
            return refToContinue
        }

        // 📄 [options: flowDynamic]: esta funcion se encarga de responder un array de respuesta esta limitado a 5 mensajes
        // para evitar bloque de whatsapp
        const flowDynamic = (listMsg = [], optListMsg = { limit: 3 }) => {
            if (!Array.isArray(listMsg))
                throw new Error('Esto debe ser un ARRAY')

            const parseListMsg = listMsg
                .map(({ body }, index) =>
                    toCtx({
                        body,
                        from,
                        keyword: null,
                        index,
                    })
                )
                .slice(0, optListMsg.limit)
            msgToSend = parseListMsg
            this.sendFlow(msgToSend, from)
            return
        }

        // 📄 Se encarga de revisar si el contexto del mensaje tiene callback y ejecutarlo
        const cbEveryCtx = (inRef) => {
            this.flowClass.allCallbacks[inRef](messageCtxInComming, {
                fallBack,
                flowDynamic,
            })
        }

        // 📄 [options: callback]: Si se tiene un callback se ejecuta
        if (!fallBackFlag) {
            if (prevMsg?.options?.capture) cbEveryCtx(prevMsg?.ref)
            for (const ite of this.flowClass.find(body)) {
                if (!ite?.options?.capture) cbEveryCtx(ite?.ref)
            }
        }

        // 📄🤘(tiene return) [options: nested(array)]: Si se tiene flujos hijos los implementa
        if (!fallBackFlag && prevMsg?.options?.nested?.length) {
            const nestedRef = prevMsg.options.nested
            const flowStandalone = nestedRef.map((f) => ({
                ...nestedRef.find((r) => r.refSerialize === f.refSerialize),
            }))

            msgToSend = this.flowClass.find(body, false, flowStandalone) || []

            for (const ite of msgToSend) {
                cbEveryCtx(ite?.ref)
            }

            this.sendFlow(msgToSend, from)
            return
        }

        // 📄🤘(tiene return) [options: capture (boolean)]: Si se tiene option boolean
        if (!fallBackFlag && !prevMsg?.options?.nested?.length) {
            const typeCapture = typeof prevMsg?.options?.capture
            const valueCapture = prevMsg?.options?.capture

            if (['string', 'boolean'].includes(typeCapture) && valueCapture) {
                msgToSend = this.flowClass.find(refToContinue?.ref, true) || []
                this.sendFlow(msgToSend, from)
                return
            }
        }

        msgToSend = this.flowClass.find(body) || []
        this.sendFlow(msgToSend, from)
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

    sendFlow = async (messageToSend, numberOrId) => {
        const queue = []
        for (const ctxMessage of messageToSend) {
            const delayMs = ctxMessage?.options?.delay || 0
            if (delayMs) await delay(delayMs)
            Queue.enqueue(() =>
                this.sendProviderAndSave(numberOrId, ctxMessage)
            )
        }
        return Promise.all(queue)
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
}
module.exports = CoreClass
