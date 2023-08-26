const { EventEmitter } = require('node:events')
const polka = require('polka')
const { urlencoded, json } = require('body-parser')
const { generateRefprovider } = require('../../common/hash')
const { getMediaUrl } = require('./utils')

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
    incomingMsg = async (req, res) => {
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
            const body = message.text?.body
            const responseObj = {
                type: message.type,
                from: message.from,
                to,
                body,
            }
            this.emit('message', responseObj)
        }

        if (message.type === 'interactive') {
            const body = message.interactive?.button_reply?.title || message.interactive?.list_reply?.id
            const title_list_reply = message.interactive?.list_reply?.title
            const responseObj = {
                type: 'interactive',
                from: message.from,
                to,
                body,
                title_list_reply,
            }
            this.emit('message', responseObj)
        }

        if (message.type === 'image') {
            const body = generateRefprovider('_event_image_')
            const idUrl = message.image?.id
            const resolvedUrl = await getMediaUrl(this.version, idUrl, this.numberId, this.jwtToken)
            const responseObj = {
                type: message.type,
                from: message.from,
                url: resolvedUrl,
                to,
                body,
            }

            this.emit('message', responseObj)
        }

        if (message.type === 'document') {
            const body = generateRefprovider('_event_document_')
            const idUrl = message.document?.id
            const resolvedUrl = await getMediaUrl(this.version, idUrl, this.numberId, this.jwtToken)
            const responseObj = {
                type: message.type,
                from: message.from,
                url: resolvedUrl, // Utilizar el valor resuelto de la promesa
                to,
                body,
            }

            this.emit('message', responseObj)
        }

        if (message.type === 'video') {
            const body = generateRefprovider('_event_video_')
            const idUrl = message.video?.id

            const resolvedUrl = await getMediaUrl(this.version, idUrl, this.numberId, this.jwtToken)

            const responseObj = {
                type: message.type,
                from: message.from,
                url: resolvedUrl, // Utilizar el valor resuelto de la promesa
                to,
                body,
            }

            this.emit('message', responseObj)
        }

        if (message.type === 'location') {
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
        }

        if (message.type === 'audio') {
            const body = generateRefprovider('_event_audio_')
            const idUrl = message.audio?.id
            const resolvedUrl = await getMediaUrl(this.version, idUrl, this.numberId, this.jwtToken)
            const responseObj = {
                type: message.type,
                from: message.from,
                url: resolvedUrl, // Utilizar el valor resuelto de la promesa
                to,
                body,
            }

            this.emit('message', responseObj)
        }

        if (message.type === 'sticker') {
            const body = generateRefprovider('_event_sticker_')

            const responseObj = {
                type: message.type,
                from: message.from,
                to,
                id: message.sticker.id,
                body,
            }

            this.emit('message', responseObj)
        }

        if (message.type === 'contacts') {
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

        if (message.type === 'order') {
            const body = generateRefprovider('_event_order_')

            const responseObj = {
                type: message.type,
                from: message.from,
                to,
                order: {
                    catalog_id: message.order.catalog_id,
                    product_items: message.order.product_items,
                },
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

    emptyCtrl = (_, res) => {
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
            console.log(`[meta]: Agregar esta url "Webhook"`)
            console.log(`[meta]: POST http://localhost:${this.metaPort}/webhook`)
            console.log(`[meta]: Más información en la documentación`)
        })
        this.emit('ready')
    }
}

module.exports = MetaWebHookServer
