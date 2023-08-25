const { EventEmitter } = require('node:events')
const polka = require('polka')
const { urlencoded, json } = require('body-parser')
const { generateRefprovider } = require('../../common/hash')
const { getMediaUrl } = require('./utils')

/**
 * 2023-08-24: 
 *     🐛 Añadido atributo message_id al objeto responseObj
 * 2023-08-23: 
 *     ✨ Añadido emitButtonAsText para modificar el comportamiento de los botones y funcionen como si de un mensaje de texto se tratara y haga reaccionar un addKeyword
 *     ♻️ agregados else if en los tipos de mensaje para aumentar un poco el performance
 */
class MetaWebHookServer extends EventEmitter {
    constructor(jwtToken, numberId, version, token, metaPort = 3000,emitButtonAsText=false) {
        super()
        this.metaServer = polka()
        this.metaPort = metaPort
        this.token = token
        this.emitButtonAsText=emitButtonAsText
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
        const message_id=message.id
        const to = body.entry[0].changes[0].value?.metadata?.display_phone_number

        if (message.type === 'text') {
            const body = message.text?.body
            const responseObj = {
                message_id,
                type: message.type,
                from: message.from,
                to,
                body,
            }
            this.emit('message', responseObj)
        }
/**
 * ✨ 2023-08-23: 
 *     Añadida la lógica para tratar los mensajes de tipo button
 */

        else if (message.type==='button') {
            const button=message.button;
            const body=this.emitButtonAsText?message.button.text:generateRefprovider('_event_button_')
            const responseObj = {
                message_id,
                type: this.emitButtonAsText?'text':message.type,
                from: message.from,
                to,
                button, //igualmente se enviará el botón con sus atributos payload y text sin importar el valor de emitButtonAsText
                body
            }
            this.emit('message', responseObj);
        }
        
        else if (message.type === 'interactive') {
            let body_interactive=message.interactive?.button_reply?.title || message.interactive?.list_reply?.id;
            if (message.interactive.type=="button_reply")
            {
                body_interactive=generateRefprovider('_event_button_');
            }
            const title_list_reply = message.interactive?.list_reply?.title;
            const responseObj = {
                message_id,
                type: 'interactive',
                from: message.from,
                to,
                body:body_interactive,
                title_list_reply,
                interactive:message.interactive
            }
            this.emit('message', responseObj);
        }

        else if (message.type === 'image') {
            const body = generateRefprovider('_event_image_')
            const idUrl = message.image?.id
            const resolvedUrl = await getMediaUrl(this.version, idUrl, this.numberId, this.jwtToken)
            const responseObj = {
                message_id,
                type: message.type,
                from: message.from,
                url: resolvedUrl,
                to,
                body,
            }

            this.emit('message', responseObj)
        }

        else if (message.type === 'document') {
            const body = generateRefprovider('_event_document_')
            const idUrl = message.document?.id
            const resolvedUrl = await getMediaUrl(this.version, idUrl, this.numberId, this.jwtToken)
            const responseObj = {
                message_id,
                type: message.type,
                from: message.from,
                url: resolvedUrl, // Utilizar el valor resuelto de la promesa
                to,
                body,
            }

            this.emit('message', responseObj)
        }

        else if (message.type === 'video') {
            const body = generateRefprovider('_event_video_')
            const idUrl = message.video?.id

            const resolvedUrl = await getMediaUrl(this.version, idUrl, this.numberId, this.jwtToken)

            const responseObj = {
                message_id,
                type: message.type,
                from: message.from,
                url: resolvedUrl, // Utilizar el valor resuelto de la promesa
                to,
                body,
            }

            this.emit('message', responseObj)
        }

        else if (message.type === 'location') {
            const body = generateRefprovider('_event_location_')

            const responseObj = {
                message_id,
                type: message.type,
                from: message.from,
                to,
                latitude: message.location.latitude,
                longitude: message.location.longitude,
                body,
            }

            this.emit('message', responseObj)
        }

        else if (message.type === 'audio') {
            const body = generateRefprovider('_event_audio_')
            const idUrl = message.audio?.id
            const resolvedUrl = await getMediaUrl(this.version, idUrl, this.numberId, this.jwtToken)
            const responseObj = {
                message_id,
                type: message.type,
                from: message.from,
                url: resolvedUrl, // Utilizar el valor resuelto de la promesa
                to,
                body,
            }

            this.emit('message', responseObj)
        }

        else if (message.type === 'sticker') {
            const body = generateRefprovider('_event_sticker_')

            const responseObj = {
                message_id,
                type: message.type,
                from: message.from,
                to,
                id: message.sticker.id,
                body,
            }

            this.emit('message', responseObj)
        }

        else if (message.type === 'contacts') {
            const body = generateRefprovider('_event_contacts_')

            const responseObj = {
                message_id,
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
