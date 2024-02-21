import { BotCtxMiddleware } from '@bot-whatsapp/bot/dist/types'
import { WASocket } from '@whiskeysockets/baileys'
import { urlencoded, json } from 'body-parser'
import { createReadStream } from 'fs'
import { EventEmitter } from 'node:events'
import { join } from 'path'
import polka, { type Polka } from 'polka'

import { BaileysProvider } from './bailey'

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
            .get('/', this.indexHome)
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
            console.log(`[bailey]: GET http://localhost:${this.port}`)
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
    <T extends Pick<BaileysProvider, 'sendMessage' | 'vendor'> & { provider: WASocket }>(
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
            res.writeHead(400, { 'Content-Type': 'application/json' })
            const jsonBody = JSON.stringify(jsonRaw)
            return res.end(jsonBody)
        }
        ctxPolka(bot, req, res)
    }

export { BaileyHttpServer, handleCtx }
