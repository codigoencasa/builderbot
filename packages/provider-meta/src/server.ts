import { BotCtxMiddleware } from '@builderbot/bot/dist/types'
import { urlencoded, json } from 'body-parser'
import { EventEmitter } from 'node:events'
import polka, { Polka } from 'polka'
import Queue from 'queue-promise'

import type { MetaProvider } from './metaProvider'
import { Message } from './types'
import { getProfile, processIncomingMessage } from './utils'

const idCtxBot = 'ctx-bot'
class MetaWebHookServer extends EventEmitter {
    public server: Polka
    public port: number
    private token: string
    private jwtToken: string
    private numberId: string
    private version: string
    private messageQueue: Queue

    constructor(jwtToken: string, numberId: string, version: string, token: string, metaPort: number = 3000) {
        super()
        this.port = metaPort
        this.token = token
        this.jwtToken = jwtToken
        this.numberId = numberId
        this.version = version
        this.server = this.buildHTTPServer()
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
    protected incomingMsg = async (req: any, res: any) => {
        const { body } = req
        const { jwtToken, numberId, version } = this
        const messages = body?.entry?.[0]?.changes?.[0]?.value?.messages
        const contacts = req?.body?.entry?.[0]?.changes?.[0]?.value?.contacts
        if (!messages?.length) {
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

    protected processMessage = (message: Message): Promise<void> => {
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
    protected tokenIsValid(mode: string, token: string) {
        return mode === 'subscribe' && this.token === token
    }

    /**
     * Verificación del token
     * @param {*} req
     * @param {*} res
     */
    protected verifyToken = async (req, res) => {
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

    protected emptyCtrl = (_, res) => {
        res.end('')
    }

    /**
     * Contruir HTTP Server
     */
    protected buildHTTPServer() {
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
    async start(vendor: BotCtxMiddleware, port?: number) {
        if (port) this.port = port

        this.server.use(async (req, _, next) => {
            req[idCtxBot] = vendor
            if (req[idCtxBot]) return next()
            return next()
        })

        this.server.listen(this.port, () => {
            console.log(`[meta]: Agregar esta url "Webhook"`)
            console.log(`[meta]: POST http://localhost:${this.port}/webhook`)
            console.log(`[meta]: Más información en la documentación`)
        })
        const profile = await getProfile(this.version, this.numberId, this.jwtToken)
        const host = {
            ...profile,
            phone: profile?.display_phone_number,
        }
        this.emit('ready')
        this.emit('host', host)
    }

    stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server.server.close((err) => {
                if (err) {
                    reject(err)
                } else {
                    resolve()
                }
            })
        })
    }
}

/**
 *
 * @param inHandleCtx
 * @returns
 */
const inHandleCtx =
    <T extends Pick<MetaProvider, 'sendMessage' | 'vendor'> & { provider: MetaProvider }>(
        ctxPolka: (bot: T | undefined, req: any, res: any) => Promise<void>
    ) =>
    (req: any, res: any) => {
        const bot: T | undefined = req[idCtxBot] ?? undefined

        const responseError = (res: any) => {
            const jsonRaw = {
                error: `You must first log in by scanning the qr code to be able to use this functionality.`,
                docs: `https://builderbot.vercel.app/errors`,
                code: `100`,
            }
            console.log(jsonRaw)
            res.writeHead(400, { 'Content-Type': 'application/json' })
            const jsonBody = JSON.stringify(jsonRaw)
            return res.end(jsonBody)
        }

        try {
            ctxPolka(bot, req, res).catch(() => responseError(res))
        } catch (err) {
            return responseError(res)
        }
    }

export { MetaWebHookServer, inHandleCtx }
