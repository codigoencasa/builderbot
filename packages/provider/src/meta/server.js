const { EventEmitter } = require('node:events')
const polka = require('polka')
const { urlencoded, json } = require('body-parser')

class MetaWebHookServer extends EventEmitter {
    metaServer
    metaPort
    token
    constructor(_token, _metaPort) {
        super()
        this.metaServer = polka()
        this.metaPort = _metaPort
        this.token = _token

        this.buildHTTPServer()
    }

    /**
     * Mensaje entrante
     * emit: 'message'
     * @param {*} req
     * @param {*} res
     */
    incomingMsg = (req, res) => {
        const { body } = req

        const messages = body.entry[0].changes[0].value?.messages

        if (!messages) return

        const [message] = messages
        const to = body.entry[0].changes[0].value.metadata.display_phone_number

        this.emit('message', {
            from: message.from,
            to,
            body: message.text?.body,
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
            return (res.statusCode = 403), res.end('No token!')
        }

        if (this.tokenIsValid(mode, token)) {
            console.log('Webhook verified--->😎😎😎😎')
            return (res.statusCode = 200), res.end(challenge)
        }

        if (!this.tokenIsValid(mode, token)) {
            return (res.statusCode = 403), res.end('No token!')
        }
    }

    /**
     * Contruir HTTP Server
     * @returns
     */
    buildHTTPServer = () => {
        this.metaServer.use(urlencoded({ extended: true })).get('/webhook', this.verifyToken)

        this.metaServer
            .use(urlencoded({ extended: true }))
            .use(json())
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
            console.log(`[meta]: POST http://localhost:${this.metaPort}/webhook`)
            console.log(`[meta]: Más información en la documentacion`)
            console.log(``)
        })
        this.emit('ready')
    }
}

module.exports = MetaWebHookServer
