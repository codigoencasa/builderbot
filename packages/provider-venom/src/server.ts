import { urlencoded, json } from 'body-parser'
import EventEmitter from 'node:events'
import { createReadStream } from 'node:fs'
import { join } from 'node:path'
import polka, { Polka } from 'polka'

import { VenomProvider } from '.'
import { BotCtxMiddleware } from './types'

const idCtxBot = 'ctx-bot'

export class VenomHttpServer extends EventEmitter {
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
            .get('/', this.stactiMiddleware)
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
            console.log(`[Venom]: GET http://localhost:${this.port}`)
        })
    }

    /**
     *
     * @param _
     * @param res
     */
    protected stactiMiddleware: polka.Middleware<any, any, any, any> = (_, res) => {
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
    <T extends Pick<VenomProvider, 'sendMessage'> & { provider: VenomProvider }>(
        ctxPolka: (bot: T | undefined, req: any, res: any) => void
    ) =>
    (req: any, res: any) => {
        const bot: T | undefined = req[idCtxBot] ?? undefined
        ctxPolka(bot, req, res)
    }
