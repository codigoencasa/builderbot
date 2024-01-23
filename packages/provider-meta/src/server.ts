import { urlencoded, json } from 'body-parser'
import { EventEmitter } from 'node:events'
import polka, { Polka } from 'polka'
import Queue from 'queue-promise'

import { Message } from './types'
import { processIncomingMessage } from './utils'

class MetaWebHookServer extends EventEmitter {
    public metaServer: Polka
    private metaPort: number
    private token: string
    private jwtToken: string
    private numberId: string
    private version: string
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
        const { jwtToken, numberId, version } = this
        const messages = body?.entry?.[0]?.changes?.[0]?.value?.messages
        const contacts = req?.body?.entry?.[0]?.changes?.[0]?.value?.contacts

        if (!messages.length) {
            res.statusCode = 200
            res.end('empty endpoint')
            return
        }

        messages.forEach(async (message: any) => {
            const [contact] = contacts
            const to = body.entry[0].changes[0].value?.metadata?.display_phone_number
            const pushName = contact?.profile?.name
            const responseObj: Message = await processIncomingMessage({
                to,
                pushName,
                message,
                jwtToken,
                numberId,
                version,
            })
            if (responseObj) {
                this.messageQueue.enqueue(() => this.processMessage(responseObj))
            }
        })

        res.statusCode = 200
        res.end('Messages enqueued')
    }

    processMessage = (message: Message): Promise<void> => {
        return new Promise((resolve, reject) => {
            try {
                this.emit('message', message)
                resolve()
            } catch (error) {
                reject(error)
            }
        })
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

    public stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.metaServer.server.close((err) => {
                if (err) {
                    reject(err)
                } else {
                    resolve()
                }
            })
        })
    }
}

export { MetaWebHookServer }
