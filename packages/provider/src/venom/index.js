const { ProviderClass } = require('@bot-whatsapp/bot')
const venom = require('venom-bot')
const { cleanNumber } = require('../web-whatsapp/utils')

class VenomProvider extends ProviderClass {
    constructor() {
        super()
        this.client
        venom
            .create({
                session: 'session-1', //nombre de la sesion o id
                multidevice: true, // Para el funcinamiento de multiusuarios.(default: true)
            })
            .then((client) => (this.client = client))
            .catch((erro) => {
                console.log(erro)
            })
    }

    sendMessage = async (number, message) => {
        const numero = cleanNumber(number)
        return this.client.sendText(numero, message)
    }
}

