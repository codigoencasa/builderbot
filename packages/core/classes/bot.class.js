/**
 * [ ] Escuchar eventos del provider
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

        this.providerClass.on('message', ({ message }) =>
            this.handleOnMessage(message)
        )
    }

    /**
     * @private
     * @param {*} ctxMessage
     */
    handleOnMessage = (ctxMessage) => {
        this.databaseClass.saveLog(ctxMessage)
        this.continue(ctxMessage)
    }

    handleEvents = (eventName) => {
        if (eventName === 'message') return
        if (eventName === 'auth_success') return
        if (eventName === 'auth_error') return
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
