const { printer } = require('../utils/interactive')

/**
 * [ ] Escuchar eventos del provider asegurarte que los provider emitan eventos
 * [ ] Guardar historial en db
 * [ ] Buscar mensaje en flow
 *
 */
class BotClass {
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
        this.databaseClass.save(body)
        const messageToSend = this.flowClass.find(body) || []
        console.log(messageToSend)
        if (Array.isArray(messageToSend)) this.sendFlow(messageToSend, from)
    }

    sendFlow = (messageToSend, numberOrId) => {
        const queue = []
        for (const message of messageToSend) {
            queue.push(this.providerClass.sendMessage(numberOrId, message))
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
module.exports = BotClass
