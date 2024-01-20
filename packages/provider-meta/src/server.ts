import { urlencoded, json } from 'body-parser'
import { EventEmitter } from 'node:events'
import polka, { Polka } from 'polka'
import Queue from 'queue-promise'

import { Message } from './types'
import { generateRefprovider, getMediaUrl } from './utils'

class MetaWebHookServer extends EventEmitter {
    private metaPort: number
    private token: string
    private jwtToken: string
    private numberId: string
    private version: string
    private metaServer: Polka
    private messageQueue: Queue

    constructor(jwtToken: string, numberId: string, version: string, token: string, metaPort: number = 3000) {
        super()
        this.metaPort = metaPort
        this.token = token
        this.jwtToken = jwtToken
        this.numberId = numberId
        this.version = version
        this.metaServer = this.buildHTTPServer()
        this.messageQueue = new Queue({
            concurrent: 1,
            interval: 50,
            start: true,
        })
    }

    /**
     * Mensaje entrante
     * emit: 'message'
     * @param {*} req
     * @param {*} res
     */
    incomingMsg = async (req: any, res: any) => {
        const { body } = req
        const messages = body?.entry?.[0]?.changes?.[0]?.value?.messages
        const contacts = req?.body?.entry?.[0]?.changes?.[0]?.value?.contacts

        if (!messages) {
            res.statusCode = 200
            res.end('empty endpoint')
            return
        }

        messages.forEach(async (message: any) => {
            const [contact] = contacts
            const to = body.entry[0].changes[0].value?.metadata?.display_phone_number
            const pushName = contact?.profile?.name
            let responseObj: Message

            switch (message.type) {
                case 'text': {
                    responseObj = {
                        type: message.type,
                        from: message.from,
                        to,
                        body: message.text?.body,
                        pushName,
                    }
                    break
                }
                case 'interactive': {
                    responseObj = {
                        type: 'interactive',
                        from: message.from,
                        to,
                        body: message.interactive?.button_reply?.title || message.interactive?.list_reply?.id,
                        title_button_reply: message.interactive?.button_reply?.title,
                        title_list_reply: message.interactive?.list_reply?.title,
                        pushName,
                    }
                    break
                }
                case 'button': {
                    responseObj = {
                        type: 'button',
                        from: message.from,
                        to,
                        body: message.button?.text,
                        payload: message.button?.payload,
                        title_button_reply: message.button?.payload,
                        pushName,
                    }
                    break
                }
                case 'image': {
                    const imageUrl = await getMediaUrl(this.version, message.image?.id, this.numberId, this.jwtToken)
                    responseObj = {
                        type: message.type,
                        from: message.from,
                        url: imageUrl,
                        to,
                        body: generateRefprovider('_event_media_'),
                        pushName,
                    }
                    break
                }
                case 'document': {
                    const documentUrl = await getMediaUrl(
                        this.version,
                        message.document?.id,
                        this.numberId,
                        this.jwtToken
                    )
                    responseObj = {
                        type: message.type,
                        from: message.from,
                        url: documentUrl,
                        to,
                        body: generateRefprovider('_event_document_'),
                        pushName,
                    }
                    break
                }
                case 'video': {
                    const videoUrl = await getMediaUrl(this.version, message.video?.id, this.numberId, this.jwtToken)
                    responseObj = {
                        type: message.type,
                        from: message.from,
                        url: videoUrl,
                        to,
                        body: generateRefprovider('_event_media_'),
                        pushName,
                    }
                    break
                }
                case 'location': {
                    responseObj = {
                        type: message.type,
                        from: message.from,
                        to,
                        latitude: message.location.latitude,
                        longitude: message.location.longitude,
                        body: generateRefprovider('_event_location_'),
                        pushName,
                    }
                    break
                }
                case 'audio': {
                    const audioUrl = await getMediaUrl(this.version, message.audio?.id, this.numberId, this.jwtToken)
                    responseObj = {
                        type: message.type,
                        from: message.from,
                        url: audioUrl,
                        to,
                        body: generateRefprovider('_event_audio_'),
                        pushName,
                    }
                    break
                }
                case 'sticker': {
                    responseObj = {
                        type: message.type,
                        from: message.from,
                        to,
                        id: message.sticker.id,
                        body: generateRefprovider('_event_media_'),
                        pushName,
                    }
                    break
                }
                case 'contacts': {
                    responseObj = {
                        type: message.type,
                        from: message.from,
                        contacts: [
                            {
                                name: message.contacts[0].name,
                                phones: message.contacts[0].phones,
                            },
                        ],
                        to,
                        body: generateRefprovider('_event_contacts_'),
                        pushName,
                    }
                    break
                }
                case 'order': {
                    responseObj = {
                        type: message.type,
                        from: message.from,
                        to,
                        order: {
                            catalog_id: message.order.catalog_id,
                            product_items: message.order.product_items,
                        },
                        body: generateRefprovider('_event_order_'),
                        pushName,
                    }
                    break
                }
                default:
                    // Lógica para manejar tipos de mensajes no reconocidos
                    break
            }

            if (responseObj) {
                this.messageQueue.enqueue(() => this.processMessage(responseObj))
            }
        })

        res.statusCode = 200
        res.end('Messages enqueued')
    }

    processMessage = (message: Message) => {
        this.emit('message', message)
    }

    /**
     * Valida el token
     * @param {string} mode
     * @param {string} token
     * @returns {boolean}
     */
    tokenIsValid(mode: string, token: string) {
        return mode === 'subscribe' && this.token === token
    }

    /**
     * Verificación del token
     * @param {*} req
     * @param {*} res
     */
    verifyToken = (req, res) => {
        const { query } = req
        const mode: string = query?.['hub.mode']
        const token: string = query?.['hub.verify_token']
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
        return polka()
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

export { MetaWebHookServer }
