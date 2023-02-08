const { EventEmitter } = require('node:events')
/**
 * Esta clase debe siempre proporcionar los siguietes metodos
 * sendMessage = Para enviar un mensaje
 *
 * @important
 * Esta clase extiende de la clase del provider OJO
 * Eventos
 *  - message
 *  - ready
 *  - error
 *  - require_action
 */

const NODE_ENV = process.env.NODE_ENV || 'dev'
class ProviderClass extends EventEmitter {
    /**
     * events: message | auth | auth_error | ...
     *
     */

    sendMessage = async (userId, message) => {
        if (NODE_ENV !== 'production') console.log('[sendMessage]', { userId, message })
        return message
    }

    getInstance = () => this.vendor
}

module.exports = ProviderClass
