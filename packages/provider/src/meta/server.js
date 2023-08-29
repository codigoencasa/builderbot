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
        const message_id=message.id
        const responseObj = {
            message_id,
            type: message.type,
            from: message.from,
            to,
        }

        if (message.type === 'text') {
            const body = message.text?.body
            Object.assign(responseObj,{
                body
            })

            this.emit('message', responseObj)
        }
        else if (message.type === 'interactive') {
            const body = message.interactive?.button_reply?.title || message.interactive?.list_reply?.id
            const title_list_reply = message.interactive?.list_reply?.title
            Object.assign(responseObj,{
                title_list_reply,
                body,
            })
            this.emit('message', responseObj)
        }
        else if (message.type === 'image') {
            const body = generateRefprovider('_event_image_')
            const idUrl = message.image?.id
            const url = await getMediaUrl(this.version, idUrl, this.numberId, this.jwtToken)
            Object.assign(responseObj,{
                url,
                body,
            })

            this.emit('message', responseObj)
        }
        else if (message.type === 'document') {
            const body = generateRefprovider('_event_document_')
            const idUrl = message.document?.id
            const url = await getMediaUrl(this.version, idUrl, this.numberId, this.jwtToken)
            Object.assign(responseObj,{
                url, // Utilizar el valor resuelto de la promesa
                body,
            })

            this.emit('message', responseObj)
        }
        else if (message.type === 'video') {
            const body = generateRefprovider('_event_video_')
            const idUrl = message.video?.id
            const url = await getMediaUrl(this.version, idUrl, this.numberId, this.jwtToken)
            Object.assign(responseObj,{
                url, // Utilizar el valor resuelto de la promesa
                body,
            })

            this.emit('message', responseObj)
        }
        else if (message.type === 'location') {
            const body = generateRefprovider('_event_location_')
            Object.assign(responseObj,{
                latitude: message.location.latitude,
                longitude: message.location.longitude,
                body,
            })

            this.emit('message', responseObj)
        }
        else if (message.type === 'audio') {
            const body = generateRefprovider('_event_voice_note_')
            const idUrl = message.audio?.id
            const url = await getMediaUrl(this.version, idUrl, this.numberId, this.jwtToken)
            Object.assign(responseObj,{
                url, // Utilizar el valor resuelto de la promesa
                body,
            })

            this.emit('message', responseObj)
        }
        else if (message.type === 'sticker') {
            const body = generateRefprovider('_event_sticker_')
            Object.assign(responseObj,{
                id: message.sticker.id,
                body,
            })

            this.emit('message', responseObj)
        }
        else if (message.type === 'contacts') {
            const body = generateRefprovider('_event_contacts_')
            Object.assign(responseObj,{
                contacts: [{ name: message.contacts[0].name, phones: message.contacts[0].phones }],
                body,
            })

            this.emit('message', responseObj)
        }
        else if (message.type === 'order') {
            const body = generateRefprovider('_event_order_')
            Object.assign(responseObj,{
                order: {
                    catalog_id: message.order.catalog_id,
                    product_items: message.order.product_items,
                },
                body,
            })

            this.emit('message', responseObj)
        }
        else
        {
            console.log(`Tipo de mensaje «${message.type}» no controlado en incomingMsg`)
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
