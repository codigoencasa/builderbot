const { EventEmitter } = require('node:events')
const polka = require('polka')
const { urlencoded } = require('body-parser')

class MetaWebHookServer extends EventEmitter {
    metaServer
    metaPort
    token
    constructor(_token, _metaPort) {
        super()
        this.metaServer = this.buildHTTPServer()
        this.metaPort = _metaPort
        this.token = _token
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
     * Valida el token
     * @alpha
     * @param {string} mode
     * @param {string} token
     * @example  tokenIsValid('subscribe', 'MYTOKEN')
     */
    tokenIsValid(mode, token) {
        return mode === 'subscribe' && this.token === token
    }

    /**
     * Verificación del token
     * @param {*} req
     * @param {*} res
     */
    verifyToken = (req, res) => {
        const { query } = req
        const mode = query['hub.mode']
        const token = query['hub.verify_token']
        const challenge = query['hub.challenge']

        if (!mode || !token) {
            return res.sendStatus(403)
        }

        if (this.tokenIsValid(mode, token)) {
            console.log('Webhook verified--->😎😎😎😎')
            res.status(200).send(challenge)
        }

        if (!this.tokenIsValid(mode, token)) {
            res.sendStatus(403)
        }
    }

    /**
     * Contruir HTTP Server
     * @returns
     */
    buildHTTPServer = () => {
        polka()
            .use(urlencoded({ extended: true }))
            .get('/webhook', this.verifyToken)

        return polka()
            .use(urlencoded({ extended: true }))
            .post('/webhook', this.incomingMsg)
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
