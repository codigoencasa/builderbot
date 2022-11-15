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
    handleMsg = ({ body, to, from }) => {
        let msgToSend = []
        console.log('____', this.databaseClass.listHistory)
        const prevMsg = [...this.databaseClass.listHistory].pop()

        if (prevMsg?.ref && prevMsg?.options?.capture) {
            msgToSend = this.flowClass.find(prevMsg.ref, true) || []
        } else {
            msgToSend = this.flowClass.find(body) || []
        }
        if (Array.isArray(msgToSend)) this.sendFlow(msgToSend, from)
    }

    sendProviderAndSave = (numberOrId, ctxMessage) => {
        const { answer } = ctxMessage
        return Promise.all([
            this.providerClass.sendMessage(numberOrId, answer),
            this.databaseClass.save(ctxMessage),
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
