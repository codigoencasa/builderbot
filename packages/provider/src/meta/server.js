const { EventEmitter } = require('node:events')
const polka = require('polka')
const { urlencoded, json } = require('body-parser')
const { generateRefprovider } = require('../../common/hash')
const { GetUrl } = require('./utils')

class MetaWebHookServer extends EventEmitter {
    constructor(jwtToken, numberId, version, token, metaPort = 3000) {
        super()
        this.metaServer = polka()
        this.metaPort = metaPort
        this.token = token

        this.jwtToken = jwtToken
        this.numberId = numberId
        this.version = version
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

        if (message.type === 'text') {
            // Si es un mensaje de texto, extrae el cuerpo del mensaje
            const body = message.text?.body
            // Luego, crea un objeto con los datos que deseas enviar al cuerpo de la respuesta
            const responseObj = {
                type: message.type,
                from: message.from,
                to,
                body,
            }
            // Finalmente, envía el objeto como respuesta utilizando el evento 'message'
            this.emit('message', responseObj)
        } else if (message.type === 'image') {
            const body = generateRefprovider('_event_image_')
            const idUrl = message.image?.id
            const url = GetUrl(this.version, idUrl, this.numberId, this.jwtToken)
            url.then((resolvedUrl) => {
                const responseObj = {
                    type: message.type,
                    from: message.from,
                    url: resolvedUrl, // Utilizar el valor resuelto de la promesa
                    to,
                    body,
                }

                this.emit('message', responseObj)
            })
        } else if (message.type === 'document') {
            const body = generateRefprovider('_event_document_')
            const idUrl = message.document?.id
            const url = GetUrl(this.version, idUrl, this.numberId, this.jwtToken)
            url.then((resolvedUrl) => {
                const responseObj = {
                    type: message.type,
                    from: message.from,
                    url: resolvedUrl, // Utilizar el valor resuelto de la promesa
                    to,
                    body,
                }

                this.emit('message', responseObj)
            })
        } else if (message.type === 'video') {
            const body = generateRefprovider('_event_video_')
            const idUrl = message.video?.id
            const url = GetUrl(this.version, idUrl, this.numberId, this.jwtToken)
            url.then((resolvedUrl) => {
                const responseObj = {
                    type: message.type,
                    from: message.from,
                    url: resolvedUrl, // Utilizar el valor resuelto de la promesa
                    to,
                    body,
                }

                this.emit('message', responseObj)
            })
        } else if (message.type === 'location') {
            const body = generateRefprovider('_event_location_')

            const responseObj = {
                type: message.type,
                from: message.from,
                to,
                latitude: message.location.latitude,
                longitude: message.location.longitude,
                body,
            }

            this.emit('message', responseObj)
        } else if (message.type === 'audio') {
            const body = generateRefprovider('_event_audio_')

            const responseObj = {
                type: message.type,
                from: message.from,
                to,
                id: message.audio.id,
                body,
            }

            this.emit('message', responseObj)
        } else if (message.type === 'sticker') {
            const body = generateRefprovider('_event_sticker_')

            const responseObj = {
                type: message.type,
                from: message.from,
                to,
                id: message.sticker.id,
                body,
            }

            this.emit('message', responseObj)
        } else if (message.type === 'contacts') {
            const body = generateRefprovider('_event_contacts_')

            const responseObj = {
                type: message.type,
                from: message.from,
                contacts: [{ name: message.contacts[0].name, phones: message.contacts[0].phones }],
                to,
                body,
            }

            this.emit('message', responseObj)
        }

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
