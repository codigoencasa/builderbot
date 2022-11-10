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

        this.providerClass.on('message', (message) =>
            console.log('message?', message)
        )
    }

    listenerBusEvents = () => [
        {
            event: 'require_action',
            func: ({ instructions }) =>
                printer(instructions, '⚡⚡ ACCION REQUERIDA ⚡⚡'),
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
    handleMsg = ({ body }) => {
        this.databaseClass.saveLog(body)
        const a = this.flowClass.find(body)
        console.log(a)
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
