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
     * @private
     * @param {*} ctxMessage
     */
    handleMsg = async (messageInComming) => {
        const { body, from } = messageInComming
        let msgToSend = []

        //Consultamos mensaje previo en DB
        const prevMsg = await this.databaseClass.getPrevByNumber(from)
        //Consultamos for refSerializada en el flow actual
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

        //Si se tiene un callback se ejecuta
        if (refToContinue && prevMsg?.options?.callback) {
            const indexFlow = this.flowClass.findIndexByRef(refToContinue?.ref)
            this.flowClass.allCallbacks[indexFlow].callback(messageInComming)
        }

        //Si se tiene anidaciones de flows, si tienes anidados obligatoriamente capture:true
        if (prevMsg?.options?.nested?.length) {
            const nestedRef = prevMsg.options.nested
            const flowStandalone = nestedRef.map((f) => ({
                ...nestedRef.find((r) => r.refSerialize === f.refSerialize),
            }))

            msgToSend = this.flowClass.find(body, false, flowStandalone) || []
            this.sendFlow(msgToSend, from)
            return
        }

        //Consultamos si se espera respuesta por parte de cliente "Ejemplo: Dime tu nombre"
        if (!prevMsg?.options?.nested?.length && prevMsg?.options?.capture) {
            msgToSend = this.flowClass.find(refToContinue?.ref, true) || []
        } else {
            msgToSend = this.flowClass.find(body) || []
        }

        this.sendFlow(msgToSend, from)
    }

    sendProviderAndSave = (numberOrId, ctxMessage) => {
        const { answer } = ctxMessage
        return Promise.all([
            this.providerClass.sendMessage(numberOrId, answer),
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
