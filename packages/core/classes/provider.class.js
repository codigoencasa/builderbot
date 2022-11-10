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
class ProviderClass extends EventEmitter {
    /**
     * events: message | auth | auth_error | ...
     *
     */

    sendMessage = async (userId, message) => {
        return message
    }
}

module.exports = ProviderClass
