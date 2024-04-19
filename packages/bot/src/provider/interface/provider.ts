import { urlencoded, json } from 'body-parser'
import cors from 'cors'
import polka, { type Polka } from 'polka'

import type { PolkaRes, ProviderHttpServer } from './server'
import { EventEmitterClass } from '../../core/eventEmitterClass'
import type { GlobalVendorArgs, BotCtxMiddlewareOptions, BotCtxMiddleware, ProviderEventTypes } from '../../types'
import { removePlus, setEvent } from '../../utils/event'

export type Vendor<T = {}> = {} & T

/**
 * Abstract class representing a ProviderClass.
 * @abstract
 * @extends EventEmitterClass
 * @implements ProviderHttpServer
 * @typeparam V - Type parameter for vendor.
 */
abstract class ProviderClass<V = any> extends EventEmitterClass<ProviderEventTypes> implements ProviderHttpServer {
    /**
     * Global arguments for vendor.
     * @abstract
     * @type {GlobalVendorArgs}
     */
    public abstract globalVendorArgs: GlobalVendorArgs

    /**
     * Vendor instance.
     * @type {Vendor<V>}
     */
    public vendor: Vendor<V>

    /**
     * HTTP server instance.
     * @type {Polka}
     */
    public server: Polka

    /**
     * Bot name identifier.
     * @type {string}
     */
    public idBotName: string = 'bot'

    /**
     * Context bot identifier.
     * @type {string}
     */
    public idCtxBot: string = 'id-ctx-bot'

    /**
     * Constructs a ProviderClass instance.
     */
    constructor() {
        super()
        this.server = this.buildHTTPServer()
    }

    /**
     * Abstract method to be executed before http initialization.
     * @protected
     * @abstract
     */
    protected abstract beforeHttpServerInit(): void

    /**
     * Abstract method to be executed after http initialization.
     * @protected
     * @abstract
     */
    protected abstract afterHttpServerInit(): void

    /**
     * Abstract method to define bus events.
     * @protected
     * @abstract
     * @returns {Array<{ event: string; func: Function }>} Array of event definitions.
     */
    protected abstract busEvents(): Array<{ event: string; func: Function }>

    /**
     * Abstract method to initialize vendor.
     * @protected
     * @abstract
     * @returns {Promise<any>} A promise indicating the completion of vendor initialization.
     */
    protected abstract initVendor(): Promise<any>

    /**
     * Abstract method to send a message.
     * @public
     * @abstract
     * @template K
     * @param {string} userId - User identifier.
     * @param {*} message - Message to be sent.
     * @param {*} [args] - Additional arguments.
     * @returns {Promise<K>} A promise resolving to the sent message.
     */
    public abstract sendMessage<K = any>(userId: string, message: any, args?: any): Promise<K>

    /**
     * Abstract method to save a file.
     * @public
     * @abstract
     * @param {*} ctx - Context information.
     * @param {{ path: string }} [options] - File save options.
     * @returns {Promise<string>} A promise resolving to the path of the saved file.
     */
    public abstract saveFile(ctx: any, options?: { path: string }): Promise<string>

    /**
     * Listen on vendor events.
     * @protected
     * @param {{ on: any, [key: string]: any }} vendor - Vendor instance.
     * @returns {void}
     */
    protected listenOnEvents(vendor: Vendor<any>): void {
        if (!vendor) {
            throw Error(`Vendor should not return empty`)
        }

        if (!this.vendor) {
            this.vendor = vendor
        }

        const listEvents = this.busEvents()
        for (const { event, func } of listEvents) {
            vendor.on(event, func)
        }
    }

    /**
     * Start the HTTP server.
     * @public
     * @param {BotCtxMiddleware} vendor - Bot context middleware.
     * @param {(arg?: any) => void} [cb=() => null] - Callback function.
     * @returns {void}
     */
    public start(vendor: BotCtxMiddleware, cb: (arg?: any) => void = () => null): void {
        this.server.use(async (req, _, next) => {
            req[this.idCtxBot] = vendor
            req[this.idBotName] = this.globalVendorArgs.name ?? 'bot'
            if (req[this.idCtxBot]) return next()
            return next()
        })

        const routes = this.getListRoutes(this.server).join('\n')
        this.server.listen(this.globalVendorArgs.port, cb(routes))
    }

    /**
     * Stop the HTTP server.
     * @public
     * @returns {Promise<void>} A promise indicating the completion of server shutdown.
     */
    public stop(): Promise<void> {
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

    /**
     * Handle context middleware.
     * @public
     * @param {Function} ctxPolka - Context polka function.
     * @returns {Function} Request handler function.
     */
    public inHandleCtx<
        T extends Pick<ProviderClass<V>, 'sendMessage'> & {
            provider: V
        }
    >(ctxPolka: (bot: T, req: Request, res: PolkaRes) => Promise<void>): (...args: any[]) => any {
        return (req, res) => {
            const bot: T | undefined = req[this.idCtxBot] ?? undefined

            const responseError = (res: PolkaRes) => {
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
    }

    /**
     * Get list of routes registered on the server.
     * @public
     * @param {Polka} app - Polka application instance.
     * @returns {string[]} Array of route definitions.
     */
    public getListRoutes(app: Polka): string[] {
        try {
            const list = (app as any).routes as { [key: string]: { old: string }[][] }
            const methodKeys = Object.keys(list)
            const parseListRoutes = methodKeys.reduce((prev, current) => {
                const routesForMethod = list[current].flat(2).map((i) => ({ method: current, path: i.old }))
                prev = prev.concat(routesForMethod)
                return prev
            }, [] as { method: string; path: string }[])
            const unique = parseListRoutes.map(
                (r) => `[${r.method}]: http://localhost:${this.globalVendorArgs.port}${r.path}`
            )
            return [...new Set(unique)]
        } catch (e) {
            console.log(`[Error]:`, e)
            return []
        }
    }
    /**
     * Build the HTTP server.
     * @public
     * @returns {Polka} Polka instance.
     */
    public buildHTTPServer(): Polka {
        return polka()
            .use(cors())
            .use(urlencoded({ extended: true }))
            .use(json())
    }

    /**
     * Get instance of the vendor.
     * @public
     * @returns {Vendor} Vendor instance.
     */
    public getInstance(): Vendor {
        return this.vendor
    }

    /**
     * Initialize HTTP server and vendor.
     * @public
     * @param {number} port - Port number.
     * @param {Pick<BotCtxMiddlewareOptions, 'blacklist'>} opts - Middleware options.
     * @returns {void}
     */
    public initAll = (
        port: number,
        opts: Pick<BotCtxMiddlewareOptions, 'blacklist' | 'state' | 'globalState'>
    ): void => {
        this.globalVendorArgs.port = port
        const methods: BotCtxMiddleware<ProviderClass> = {
            sendMessage: this.sendMessage,
            provider: this,
            blacklist: opts.blacklist,
            state: opts.state,
            globalState: opts.globalState,
            dispatch: (customEvent, payload) => {
                this.emit('message', {
                    ...payload,
                    body: setEvent(customEvent),
                    name: payload.name,
                    from: removePlus(payload.from),
                })
            },
        }

        this.initVendor()
            .then((v) => this.listenOnEvents(v))
            .then(() => {
                this.beforeHttpServerInit()

                this.start(methods, (routes) => {
                    this.emit('notice', {
                        title: '🛜  HTTP Server ON ',
                        instructions: routes,
                    })
                    this.afterHttpServerInit()
                })
            })
        return
    }
}

export { ProviderClass }
