const { EventEmitter } = require('node:events')
const polka = require('polka')
const { urlencoded } = require('body-parser')
const { parseNumber } = require('./utils')

/**
 * Encargado de levantar un servidor HTTP con una hook url
 * [POST] /twilio-hook
 */
class TwilioWebHookServer extends EventEmitter {
    twilioServer
    twilioPort
    constructor(_twilioPort) {
        super()
        this.twilioServer = this.buildHTTPServer()
        this.twilioPort = _twilioPort
    }

    /**
     * Mensaje entrante
     * emit: 'message'
     * @param {*} req
     * @param {*} res
     */
    incomingMsg = (req, res) => {
        const { body } = req
        this.emit('message', {
            from: parseNumber(body.From),
            to: parseNumber(body.To),
            body: body.Body,
        })
        const json = JSON.stringify({ body })
        res.end(json)
    }

    /**
     * Contruir HTTP Server
     * @returns
     */
    buildHTTPServer = () => {
        return polka()
            .use(urlencoded({ extended: true }))
            .post('/twilio-hook', this.incomingMsg)
    }

    /**
     * Puerto del HTTP
     * @param {*} port default 3000
     */
    start = () => {
        this.twilioServer.listen(this.twilioPort, () => {
            console.log(``)
            console.log(`[Twilio]: Agregar esta url "WHEN A MESSAGE COMES IN"`)
            console.log(`[Twilio]: POST http://localhost:${this.twilioPort}/twilio-hook`)
            console.log(`[Twilio]: Más información en la documentacion`)
            console.log(``)
        })
        this.emit('ready')
    }
}

module.exports = TwilioWebHookServer
