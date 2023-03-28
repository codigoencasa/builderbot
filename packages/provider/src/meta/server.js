const { EventEmitter } = require('node:events')
const polka = require('polka')
const { urlencoded, json } = require('body-parser')

class MetaWebHookServer extends EventEmitter {
    constructor(token, metaPort = 3000) {
        super()
        this.metaServer = polka()
        this.metaPort = metaPort
        this.token = token
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
        const messages = body?.entry?.[0]?.changes?.[0]?.value?.messages

        if (!messages) {
            res.statusCode = 200
            res.end('empty endpoint')
            return
        }

        const [message] = messages
        const to = body.entry[0].changes[0].value?.metadata?.display_phone_number

        this.emit('message', {
            from: message.from,
            to,
            body: message.type === 'text' ? message.text?.body : message.interactive?.button_reply.title,
        })

        const json = JSON.stringify({ body })
        res.end(json)
    }

    /**
     * Valida el token
     * @param {string} mode
     * @param {string} token
     * @returns {boolean}
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
        const mode = query?.['hub.mode']
        const token = query?.['hub.verify_token']
        const challenge = query?.['hub.challenge']

        if (!mode || !token) {
            res.statusCode = 403
            res.end('No token!')
            return
        }

        if (this.tokenIsValid(mode, token)) {
            console.log('Webhook verified')
            res.statusCode = 200
            res.end(challenge)
            return
        }

        res.statusCode = 403
        res.end('Invalid token!')
    }

    emptyCtrl = (req, res) => {
        res.end('')
    }

    /**
     * Contruir HTTP Server
     */
    buildHTTPServer() {
        this.metaServer
            .use(urlencoded({ extended: true }))
            .use(json())
            .get('/', this.emptyCtrl)
            .get('/webhook', this.verifyToken)
            .post('/webhook', this.incomingMsg)
    }

    /**
     * Iniciar el servidor HTTP
     */
    start() {
        this.metaServer.listen(this.metaPort, () => {
            console.log(`[meta]: Agregar esta url "WHEN A MESSAGE COMES IN"`)
            console.log(`[meta]: POST http://localhost:${this.metaPort}/webhook`)
            console.log(`[meta]: Más información en la documentación`)
        })
        this.emit('ready')
    }
}

module.exports = MetaWebHookServer
