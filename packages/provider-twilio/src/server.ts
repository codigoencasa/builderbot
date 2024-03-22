import { utils } from '@builderbot/bot'
import type { BotCtxMiddleware } from '@builderbot/bot/dist/types'
import { urlencoded, json } from 'body-parser'
import cors from 'cors'
import mime from 'mime-types'
import { EventEmitter } from 'node:events'
import { existsSync, createReadStream } from 'node:fs'
import type { Middleware, Polka } from 'polka'
import polka from 'polka'

import type { TwilioProvider } from './'
import type { TwilioRequestBody } from './types'
import { TwilioPayload } from './types'
import { parseNumber } from './utils'

const idCtxBot = 'id-ctx-bot'
const idBotName = 'id-bot'

/**
 * Encargado de levantar un servidor HTTP con una hook url
 * [POST] /twilio-hook
 */
class TwilioWebHookServer extends EventEmitter {
    public server: Polka
    public port: number

    constructor(twilioPort: number) {
        super()
        this.server = this.buildHTTPServer()
        this.port = twilioPort
    }

    protected getListRoutes = (app: Polka): string[] => {
        try {
            const list = (app as any).routes as { [key: string]: { old: string }[][] }
            const methodKeys = Object.keys(list)
            const parseListRoutes = methodKeys.reduce((prev, current) => {
                const routesForMethod = list[current].flat(2).map((i) => ({ method: current, path: i.old }))
                prev = prev.concat(routesForMethod)
                return prev
            }, [] as { method: string; path: string }[])
            const unique = parseListRoutes.map((r) => `[${r.method}]: http://localhost:${this.port}${r.path}`)
            return [...new Set(unique)]
        } catch (e) {
            console.log(`[Error]:`, e)
            return []
        }
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
            ...req.body,
            from: parseNumber(body.From),
            to: parseNumber(body.To),
            host: parseNumber(body.To),
            body: body.Body,
            name: `${body?.ProfileName}`,
        }

        if (body?.NumMedia !== '0' && body?.MediaContentType0) {
            const type = body?.MediaContentType0.split('/')[0]
            switch (type) {
                case 'audio':
                    payload.body = utils.generateRefProvider('_event_voice_note_')
                    break
                case 'image':
                case 'video':
                    payload.body = utils.generateRefProvider('_event_media_')
                    break
                case 'application':
                    payload.body = utils.generateRefProvider('_event_document_')
                    break
                case 'text':
                    payload.body = utils.generateRefProvider('_event_contacts_')
                    break
                default:
                    // Lógica para manejar tipos de mensajes no reconocidos
                    break
            }
        } else {
            if (body.Latitude && body.Longitude) {
                payload.body = utils.generateRefProvider('_event_location_')
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
    protected buildHTTPServer(): Polka {
        return polka()
            .use(cors())
            .use(urlencoded({ extended: true }))
            .use(json())
            .post('/webhook', this.incomingMsg)
            .get('/tmp', this.handlerLocalMedia)
    }

    /**
     * Iniciar el servidor HTTP
     */
    start(vendor: BotCtxMiddleware, port?: number, args?: { botName: string }, cb: (arg?: any) => void = () => null) {
        if (port) this.port = port

        this.server.use(async (req, _, next) => {
            req[idCtxBot] = vendor
            req[idBotName] = args?.botName ?? 'bot'
            if (req[idCtxBot]) return next()
            return next()
        })

        const routes = this.getListRoutes(this.server).join('\n')
        this.server.listen(this.port, cb(routes))
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
    <T extends Pick<TwilioProvider, 'sendMessage' | 'vendor'> & { provider: TwilioProvider }>(
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

export { TwilioWebHookServer, TwilioPayload, inHandleCtx }
