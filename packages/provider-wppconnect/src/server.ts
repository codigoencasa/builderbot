import { urlencoded, json } from 'body-parser'
import EventEmitter from 'node:events'
import { createReadStream } from 'node:fs'
import { join } from 'node:path'
import polka, { Polka } from 'polka'

import { WPPConnectProviderClass } from '.'
import { BotCtxMiddleware } from './types'

const idCtxBot = 'ctx-bot'

export class WPPConnectHttpServer extends EventEmitter {
    public server: Polka
    public port: number
    #botName: string

    constructor(botName: string, _port: number) {
        super()
        this.port = _port
        this.#botName = botName
        this.server = this.buildHTTPServer()
    }

    /**
     * Contruir HTTP Server
     */
    protected buildHTTPServer(): Polka {
        return polka()
            .use(urlencoded({ extended: true }))
            .use(json())
            .get('/qr', this.indexHome)
    }

    /**
     * Iniciar el servidor HTTP
     */

    start(vendor: BotCtxMiddleware, port?: number) {
        if (port) this.port = port
        this.server.use(async (req, _, next) => {
            req[idCtxBot] = vendor
            if (req[idCtxBot]) return next()
            return next()
        })

        this.server.listen(this.port, () => {
            console.log(`[WPPConnect]: GET http://localhost:${this.port}/qr`)
            console.log(`[WPPConnect]: POST http://localhost:${this.port}/message`)
        })
    }

    /**
     *
     * @param _
     * @param res
     */
    protected indexHome = (_, res) => {
        const qrPath = join(process.cwd(), `${this.#botName}.qr.png`)
        const fileStream = createReadStream(qrPath)
        res.writeHead(200, { 'Content-Type': 'image/png' })
        fileStream.pipe(res)
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
 * @param ctxPolka
 * @returns
 */
export const handleCtx =
    <T extends Pick<WPPConnectProviderClass, 'sendMessage' | 'vendor'> & { provider: WPPConnectProviderClass }>(
        ctxPolka: (bot: T | undefined, req: any, res: any) => void
    ) =>
    (req: any, res: any) => {
        const bot: T | undefined = req[idCtxBot] ?? undefined
        if (!bot?.vendor) {
            const jsonRaw = {
                error: `You must first log in by scanning the qr code to be able to use this functionality.`,
                docs: `https://builderbot.vercel.app/errors`,
                code: `100`,
            }
            console.log(jsonRaw)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            const jsonBody = JSON.stringify(jsonRaw)
            return res.end(jsonBody)
        }
        ctxPolka(bot, req, res)
    }
