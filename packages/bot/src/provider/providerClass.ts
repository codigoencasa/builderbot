import { EventEmitter } from 'node:events'

import { BotCtxMiddlewareOptions } from '../types'

export type Vendor<T = {}> = {} & T

const NODE_ENV = process.env.NODE_ENV || 'dev'

class ProviderClass extends EventEmitter {
    vendor: Vendor = {}
    globalVendorArgs: any

    public async sendMessage<K = any>(userId: string, message: any, args?: any): Promise<K> {
        if (NODE_ENV !== 'production') {
            console.log('[sendMessage]', { userId, message, args })
        }
        return Promise.resolve(message)
    }

    public async saveFile(ctx: any, options?: { path: string }): Promise<string> {
        console.log(`ctx`, ctx)
        console.log(`options`, options)
        console.log(`Ups it is provider don't implement this function`)
        return ``
    }

    public getInstance(): Vendor {
        return this.vendor
    }

    public inHandleCtx = <T extends Pick<any, 'sendMessage' | 'vendor'> & { provider: any }>(
        ctxPolka: (bot: T | undefined, req: any, res: any) => Promise<void>
    ) => {
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

        return (req: any, res: any) => {
            const bot: T | undefined = req['id-ctx-bot'] ?? undefined
            try {
                ctxPolka(bot, req, res).catch(() => responseError(res))
            } catch (err) {
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
        }
    }

    /**
     *
     * @param port
     * @param blacklist
     * @returns
     */
    public initHttpServer = (port: number, opts: Pick<BotCtxMiddlewareOptions, 'blacklist'>) => {
        console.log(`Ups it is provider initHttpServer ${port}`, opts)
        return
    }
}

export { ProviderClass }
