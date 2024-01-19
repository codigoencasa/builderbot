import { utils } from '@bot-whatsapp/bot'
import { urlencoded, json } from 'body-parser'
import mime from 'mime-types'
import { EventEmitter } from 'node:events'
import { existsSync, createReadStream } from 'node:fs'
import polka, { Middleware, Polka } from 'polka'

import { parseNumber } from './utils'

export interface TwilioRequestBody {
    From: string
    To: string
    Body: string
    NumMedia: string
    MediaContentType0?: string
    Latitude?: string
    Longitude?: string
}

export interface TwilioPayload {
    from: string
    to: string
    body: string
}

/**
 * Encargado de levantar un servidor HTTP con una hook url
 * [POST] /twilio-hook
 */
class TwilioWebHookServer extends EventEmitter {
    private twilioServer: Polka
    private twilioPort: number

    constructor(twilioPort: number) {
        super()
        this.twilioServer = this.buildHTTPServer()
        this.twilioPort = twilioPort
    }

    /**
     * Mensaje entrante
     * emit: 'message'
     * @param req
     * @param res
     */
    private incomingMsg: Middleware = (req, res) => {
        const body = req.body as TwilioRequestBody
        const payload: TwilioPayload = {
            from: parseNumber(body.From),
            to: parseNumber(body.To),
            body: body.Body,
        }

        if (body.NumMedia !== '0' && body.MediaContentType0) {
            const type = body.MediaContentType0.split('/')[0]
            switch (type) {
                case 'audio':
                    payload.body = utils.generateRefprovider('_event_voice_note_')
                    break
                case 'image':
                case 'video':
                    payload.body = utils.generateRefprovider('_event_media_')
                    break
                case 'application':
                    payload.body = utils.generateRefprovider('_event_document_')
                    break
                case 'text':
                    payload.body = utils.generateRefprovider('_event_contacts_')
                    break
                default:
                    // Lógica para manejar tipos de mensajes no reconocidos
                    break
            }
        } else {
            if (body.Latitude && body.Longitude) {
                payload.body = utils.generateRefprovider('_event_location_')
            }
        }

        this.emit('message', payload)
        const jsonResponse = JSON.stringify({ body })
        res.end(jsonResponse)
    }

    /**
     * Manejar los local media como
     * C:\\Projects\\bot-restaurante\\tmp\\menu.png
     * para que puedas ser llevar a una url online
     * @param req
     * @param res
     */
    private handlerLocalMedia: Middleware = (req, res) => {
        const query = req.query as { path?: string }
        const file = query?.path
        if (!file) return res.end(`path: invalid`)
        const decryptPath = utils.decryptData(file)
        const decodeFile = decodeURIComponent(decryptPath)
        if (!existsSync(decodeFile)) return res.end(`not exits: ${decodeFile}`)
        const fileStream = createReadStream(decodeFile)
        const mimeType = mime.lookup(decodeFile) || 'application/octet-stream'
        res.writeHead(200, { 'Content-Type': mimeType })
        fileStream.pipe(res)
    }

    /**
     * Construir HTTP Server
     * @returns Polka instance
     */
    private buildHTTPServer(): Polka {
        return polka()
            .use(urlencoded({ extended: true }))
            .use(json())
            .post('/twilio-hook', this.incomingMsg)
            .get('/tmp', this.handlerLocalMedia)
    }

    /**
     * Iniciar el servidor HTTP
     */
    public start(): void {
        this.twilioServer.listen(this.twilioPort, () => {
            console.log(``)
            console.log(`[Twilio]: Agregar esta url "WHEN A MESSAGE COMES IN"`)
            console.log(`[Twilio]: POST http://localhost:${this.twilioPort}/twilio-hook`)
            console.log(`[Twilio]: Más información en la documentación`)
            console.log(``)
        })
        this.emit('ready')
    }

    public stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.twilioServer.server.close((err) => {
                if (err) {
                    reject(err)
                } else {
                    resolve()
                }
            })
        })
    }
}

export { TwilioWebHookServer }
