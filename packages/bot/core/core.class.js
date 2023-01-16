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

        // 📄 Esta funcion se encarga de enviar un array de mensajes dentro de este ctx
        const sendFlow = async (messageToSend, numberOrId) => {
            const queue = []
            for (const ctxMessage of messageToSend) {
                const delayMs = ctxMessage?.options?.delay || 0
                if (delayMs) await delay(delayMs)
                QueuePrincipal.enqueue(() =>
                    Promise.all([
                        this.sendProviderAndSave(numberOrId, ctxMessage),
                        resolveCbEveryCtx(ctxMessage),
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
                .map(({ body }, index) =>
                    toCtx({
                        body,
                        from,
                        keyword: null,
                        index,
                    })
                )
                .slice(0, optListMsg.limit)
            for (const msg of parseListMsg) {
                await this.sendProviderAndSave(from, msg)
            }
            return
        }

        // 📄 Se encarga de revisar si el contexto del mensaje tiene callback o fallback
        const resolveCbEveryCtx = async (ctxMessage) => {
            if (prevMsg?.options?.capture) return cbEveryCtx(prevMsg?.ref)
            if (!ctxMessage?.options?.capture)
                return await cbEveryCtx(ctxMessage?.ref)
        }

        // 📄 Se encarga de revisar si el contexto del mensaje tiene callback y ejecutarlo
        const cbEveryCtx = async (inRef) => {
            if (!this.flowClass.allCallbacks[inRef]) return Promise.resolve()
            return this.flowClass.allCallbacks[inRef](messageCtxInComming, {
                fallBack,
                flowDynamic,
            })
        }

        if (prevMsg?.ref) resolveCbEveryCtx(prevMsg)

        // 📄 [options: callback]: Si se tiene un callback se ejecuta
        //TODO AQUI
        // if (!fallBackFlag) {
        //     if (prevMsg?.options?.capture) cbEveryCtx(prevMsg?.ref)
        //     for (const ite of this.flowClass.find(body)) {
        //         if (!ite?.options?.capture) cbEveryCtx(ite?.ref)
        //     }
        // }

        // 📄🤘(tiene return) [options: nested(array)]: Si se tiene flujos hijos los implementa
        if (!fallBackFlag && prevMsg?.options?.nested?.length) {
            const nestedRef = prevMsg.options.nested
            const flowStandalone = nestedRef.map((f) => ({
                ...nestedRef.find((r) => r.refSerialize === f.refSerialize),
            }))

            msgToSend = this.flowClass.find(body, false, flowStandalone) || []

            // //TODO AQUI
            // for (const ite of msgToSend) {
            //     cbEveryCtx(ite?.ref)
            // }

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
}
module.exports = CoreClass
