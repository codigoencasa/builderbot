const { EventEmitter } = require('node:events')
const polka = require('polka')
const { urlencoded } = require('body-parser')

class MetaWebHookServer extends EventEmitter {
    metaServer
    metaPort
    verifyToken
    constructor(_verifyToken, _metaPort) {
        super()
        this.metaServer = this.buildHTTPServer()
        this.metaPort = _metaPort
        this.verifyToken = _verifyToken
    }

    /**
     * Mensaje entrante
     * emit: 'message'
     * @param {*} req
     * @param {*} res
     */
    incomingMsg = (req, res) => {
        const { body } = req
        const message = body.entry[0].changes[0].value.messages[0]
        const to = body.entry[0].changes[0].value.metadata.display_phone_number
        this.emit('message', {
            from: message.from,
            to,
            body: message.text.body,
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
            .post('/meta-hook', this.incomingMsg)
    }

    /**
     * Puerto del HTTP
     * @param {*} port default 3000
     */
    start = () => {
        this.metaServer.listen(this.metaPort, () => {
            console.log(``)
            console.log(`[meta]: Agregar esta url "WHEN A MESSAGE COMES IN"`)
            console.log(
                `[meta]: POST http://localhost:${this.metaPort}/meta-hook`
            )
            console.log(`[meta]: Más información en la documentacion`)
            console.log(``)
        })
        this.emit('ready')
    }
}

module.exports = MetaWebHookServer
