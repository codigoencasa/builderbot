import { WASocket } from '@whiskeysockets/baileys'
import { urlencoded, json } from 'body-parser'
import { createReadStream } from 'fs'
import { EventEmitter } from 'node:events'
import { join } from 'path'
import polka, { Polka } from 'polka'

import { BaileysProvider } from './bailey'
import { BotCtxMiddleware } from './type'

const idCtxBot = 'ctx-bot'

class BaileyHttpServer extends EventEmitter {
    public server: Polka
    public port: number

    constructor(_port: number) {
        super()
        this.port = _port
        this.server = this.buildHTTPServer()
    }

    /**
     *
     * @param _
     * @param res
     */
    protected indexHome = (_, res) => {
        const qrPath = join(process.cwd(), `bot.qr.png`)
        const fileStream = createReadStream(qrPath)
        res.writeHead(200, { 'Content-Type': 'image/png' })
        fileStream.pipe(res)
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
    start(vendor: BotCtxMiddleware) {
        this.server.use(async (req, _, next) => {
            req[idCtxBot] = vendor
            if (req[idCtxBot]) return next()
            return next()
        })

        this.server.listen(this.port, () => {
            console.log(`[bailey]: GET http://localhost:${this.port}/`)
            console.log(`[bailey]: POST http://localhost:${this.port}/message`)
        })
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
const handleCtx =
    <T extends Pick<BaileysProvider, 'sendMessage'> & { provider: WASocket }>(
        ctxPolka: (bot: T | undefined, req: any, res: any) => void
    ) =>
    (req: any, res: any) => {
        const bot: T | undefined = req[idCtxBot] ?? undefined
        ctxPolka(bot, req, res)
    }

export { BaileyHttpServer, handleCtx }
