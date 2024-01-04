const { EventEmitter } = require('node:events')
const { existsSync, createReadStream } = require('node:fs')
const mime = require('mime-types')
const polka = require('polka')
const { urlencoded, json } = require('body-parser')
const { parseNumber } = require('./utils')
const { generateRefprovider } = require('../../common/hash')

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
        const payload = {
            ...body,
            from: parseNumber(body.From),
            to: parseNumber(body.To),
            body: body.Body,
        }
        if (body.NumMedia !== '0' && body.MediaContentType0) {
            const type = body.MediaContentType0.split('/')[0]
            switch (type) {
                case 'audio': {
                    payload.body = generateRefprovider('_event_voice_note_')
                    break
                }
                case 'image':
                case 'video': {
                    payload.body = generateRefprovider('_event_media_')
                    break
                }
                case 'application': {
                    payload.body = generateRefprovider('_event_document_')
                    break
                }
                case 'text': {
                    payload.body = generateRefprovider('_event_contacts_')
                    break
                }
                default:
                    // Lógica para manejar tipos de mensajes no reconocidos
                    break
            }
        } else {
            if (body.Latitude && body.Longitude) {
                payload.body = generateRefprovider('_event_location_')
            }
        }
        this.emit('message', payload)
        const json = JSON.stringify({ body })
        res.end(json)
    }

    /**
     * Manejar los local media como
     * C\\Projects\\bot-restaurante\\tmp\\menu.png
     * para que puedas ser llevar a una url online
     * @param {*} req
     * @param {*} res
     */
    handlerLocalMedia = (req, res) => {
        const { query } = req
        const file = query?.path
        if (!file) return res.end(`path: invalid`)
        const decodeFile = decodeURIComponent(file)
        if (!existsSync(decodeFile)) return res.end(`not exits: ${decodeFile}`)
        const fileStream = createReadStream(decodeFile)
        const mimeType = mime.lookup(decodeFile)
        res.writeHead(200, { 'Content-Type': mimeType })
        fileStream.pipe(res)
    }

    /**
     * Contruir HTTP Server
     * @returns
     */
    buildHTTPServer = () => {
        return polka()
            .use(urlencoded({ extended: true }))
            .use(json())
            .post('/twilio-hook', this.incomingMsg)
            .get('/tmp', this.handlerLocalMedia)
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
