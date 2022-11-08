const { EventEmitter } = require('node:events')

/**
 * Clase principal del BOT
 */
class BotClass extends EventEmitter {
    flowClass
    databaseClass
    providerClass
    constructor(_flow, _database, _provider) {
        super()
        this.flowClass = _flow
        this.databaseClass = _database
        this.providerClass = _provider

        this.on('message', (ctxMessage) => this.handleOnMessage(ctxMessage))
    }

    handleOnMessage = (ctxMessage) => {
        this.databaseClass.saveLog(ctxMessage)
        this.continue(ctxMessage.body)
    }

    continue = (message, ref = false) => {
        const responde = this.flowClass.find(message, ref)
        if (responde) {
            this.providerClass.sendMessage(responde.answer)
            this.continue(null, responde.ref)
        }
    }
}
module.exports = BotClass
