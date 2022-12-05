const { toCtx } = require('../io/methods')
const { printer } = require('../utils/interactive')

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
            event: 'require_action',
            func: ({ instructions, title = '⚡⚡ ACCION REQUERIDA ⚡⚡' }) =>
                printer(instructions, title),
        },
        {
            event: 'ready',
            func: () => printer('Provider conectado y listo'),
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
     *
     * @param {*} messageInComming
     * @returns
     */
    handleMsg = async (messageInComming) => {
        const { body, from } = messageInComming
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

        // 📄 [options: fallback]: esta funcion se encarga de repetir el ultimo mensaje
        const fallBack = () => {
            fallBackFlag = true
            msgToSend = this.flowClass.find(refToContinue?.keyword, true) || []
            this.sendFlow(msgToSend, from)
            return refToContinue
        }

        // 📄 [options: callback]: Si se tiene un callback se ejecuta
        if (!fallBackFlag && refToContinue && prevMsg?.options?.callback) {
            const indexFlow = this.flowClass.findIndexByRef(refToContinue?.ref)
            this.flowClass.allCallbacks[indexFlow].callback(messageInComming, {
                fallBack,
            })
        }

        // 📄🤘(tiene return) [options: nested(array)]: Si se tiene flujos hijos los implementa
        if (!fallBackFlag && prevMsg?.options?.nested?.length) {
            const nestedRef = prevMsg.options.nested
            const flowStandalone = nestedRef.map((f) => ({
                ...nestedRef.find((r) => r.refSerialize === f.refSerialize),
            }))

            msgToSend = this.flowClass.find(body, false, flowStandalone) || []
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

    sendFlow = (messageToSend, numberOrId) => {
        const queue = []
        for (const ctxMessage of messageToSend) {
            queue.push(this.sendProviderAndSave(numberOrId, ctxMessage))
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
