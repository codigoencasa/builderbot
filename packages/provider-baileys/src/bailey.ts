/**
 * LAYER: Infrastructure
 * Contains: Boom, PathOrFileDescriptor
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(n^2) score:1
 * keywords: [Boom, PathOrFileDescriptor]
 * GOAL: Own the "bailey" concern of the provider-baileys package.
 */
import { ProviderClass, utils } from '@builderbot/bot'
import type { BotContext, Button, SendOptions } from '@builderbot/bot/dist/types'
import type { Boom } from '@hapi/boom'
import { Console } from 'console'
import type { PathOrFileDescriptor } from 'fs'
import { createReadStream, createWriteStream, readFileSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import mime from 'mime-types'
import NodeCache from 'node-cache'
import { tmpdir } from 'os'
import { join, basename, resolve } from 'path'
import pino from 'pino'
import type polka from 'polka'
import { finished } from 'stream/promises'
import type { IStickerOptions } from 'wa-sticker-formatter'
import { Sticker } from 'wa-sticker-formatter'

import {
    AnyMediaMessageContent,
    AnyMessageContent,
    BaileysEventMap,
    Browsers,
    WAMessage,
    WASocket,
    MessageUpsertType,
    isJidGroup,
    isJidBroadcast,
    DisconnectReason,
    downloadMediaMessage,
    fetchLatestBaileysVersion,
    fetchLatestWaWebVersion,
    getAggregateVotesInPollMessage,
    makeCacheableSignalKeyStore,
    makeWASocketOther,
    proto,
    useMultiFileAuthState,
    PollMessageOptions,
    WAVersion,
    WABrowserDescription,
} from './baileyWrapper'
import {
    createLidCache,
    extractAndCacheLidFromMessage,
    resolveLidToPn,
    asLidJid,
    isMessageContext,
    type LidCache,
    type MessageContext,
    type LidJid,
} from './lidCache'
import { cleanSessionFiles, releaseTmp } from './releaseTmp'
import type { BaileyGlobalVendorArgs } from './type'
import { baileyGenerateImage, baileyCleanNumber, baileyIsValidNumber, emptyDirSessions } from './utils'

class BaileysProvider extends ProviderClass<WASocket> {
    public globalVendorArgs: BaileyGlobalVendorArgs = {
        name: `bot`,
        gifPlayback: false,
        usePairingCode: false,
        browser: Browsers.appropriate('Chrome') as WABrowserDescription,
        phoneNumber: null,
        useBaileysStore: true,
        port: 3000,
        timeRelease: 0, //21600000
        writeMyself: 'none',
        groupsIgnore: true,
        allowGroups: false,
        readStatus: false,
        experimentalStore: false,
        autoRefresh: 0,
        experimentalSyncMessage: undefined,
        fallBackAction: undefined,
        captureProcessSignals: false,
    }

    private reconnectAttempts = 0
    private maxReconnectAttempts = 10
    private reconnectDelay = 1000 // 1 segundo inicial

    msgRetryCounterCache?: NodeCache
    userDevicesCache?: NodeCache
    messageCache?: NodeCache

    private logger: Console
    private logStream: NodeJS.WritableStream

    /** Dedupe window: messageId__from → expiry timestamp (T2, RFC 0002) */
    private idsDuplicates = new Map<string, number>()
    private mapSet = new Set()

    private static readonly DEDUPE_TTL_MS = 5 * 60 * 1000
    private static readonly DEDUPE_MAX_ENTRIES = 5000

    /** LID → Phone Number cache for privacy-preserving identifier resolution */
    private lidCache: LidCache

    /** Prevent new work as soon as shutdown starts. */
    private isCleaned = false
    private cleanupPromise?: Promise<void>
    private initPromise?: Promise<WASocket['ev'] | undefined>
    private reconnectTimer?: NodeJS.Timeout
    private reconnectTask?: Promise<void>
    private reconnectInProgress = false
    private sessionCleanupTimer?: NodeJS.Timeout

    /** Handle for the periodic housekeeping interval */
    private cleanupInterval?: NodeJS.Timeout

    /** Process signal handlers registered by this instance (opt-in) */
    private signalHandlers: Array<{ event: NodeJS.Signals; handler: (...args: any[]) => void }> = []

    constructor(args: Partial<BaileyGlobalVendorArgs>) {
        super()

        this.logStream = createWriteStream(`${process.cwd()}/baileys.log`, {
            flags: 'a',
            autoClose: true,
            emitClose: true,
        })

        this.logger = new Console({
            stdout: this.logStream,
            stderr: this.logStream,
        })

        this.msgRetryCounterCache = new NodeCache({
            stdTTL: 1800, // 30 minutos (más tiempo para reintentos)
            checkperiod: 300, // Limpieza cada 5 minutos (menos frecuente)
            maxKeys: 50000, // 50K entradas (más espacio)
            deleteOnExpire: true,
            useClones: false,
            forceString: false,
            errorOnMissing: false,
        })

        this.userDevicesCache = new NodeCache({
            stdTTL: 7200, // 2 horas (dispositivos cambian poco)
            checkperiod: 600, // Limpieza cada 10 minutos
            maxKeys: 5000, // Más dispositivos
            deleteOnExpire: true,
            useClones: false,
            forceString: false,
            errorOnMissing: false,
        })

        // Cache para almacenar mensajes enviados (soluciona el problema "this message can take a while" en iOS)
        this.messageCache = new NodeCache({
            stdTTL: 43200, // 12 horas (optimizado para alto volumen)
            checkperiod: 1800, // Limpieza cada 30 minutos
            maxKeys: 20000, // 20K mensajes
            deleteOnExpire: true,
            useClones: false,
            forceString: false,
            errorOnMissing: false,
        })

        this.globalVendorArgs = { ...this.globalVendorArgs, ...args }

        // Initialize LID cache (hybrid file+memory or memory-only based on config)
        this.lidCache = this.initializeLidCache()

        this.setupCleanupHandlers()
        this.setupPeriodicCleanup()
    }

    /** Register only this instance's opt-in shutdown handlers. */
    private setupCleanupHandlers() {
        // Opt-in only: by default the provider never touches the host's process
        // lifecycle. `removeAllListeners` is deliberately avoided so we never
        // clobber handlers registered by the app or by other providers.
        if (!this.globalVendorArgs.captureProcessSignals) return

        const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGUSR1', 'SIGUSR2']

        for (const signal of signals) {
            const handler = () => {
                this.logger.log(`[${new Date().toISOString()}] Received ${signal}, shutting down...`)
                this.cleanup()
                    .catch((error) => console.error('Error durante cleanup:', error))
                    .finally(() => process.exit(0))
            }
            process.on(signal, handler)
            this.signalHandlers.push({ event: signal, handler })
        }
    }

    private setupPeriodicCleanup() {
        // Limpiar duplicados cada 10 minutos para evitar memory leaks
        this.cleanupInterval = setInterval(() => {
            const maxSize = 1000
            const now = Date.now()
            for (const [key, expiresAt] of this.idsDuplicates) {
                if (expiresAt <= now) this.idsDuplicates.delete(key)
            }
            if (this.idsDuplicates.size > maxSize) {
                const excess = this.idsDuplicates.size - maxSize
                let removed = 0
                for (const key of this.idsDuplicates.keys()) {
                    if (removed >= excess) break
                    this.idsDuplicates.delete(key)
                    removed++
                }
                this.logger.log(
                    `[${new Date().toISOString()}] Cleaning duplicates map: ${this.idsDuplicates.size + removed} -> ${this.idsDuplicates.size}`
                )
            }

            // Limpiar mapSet si tiene demasiadas entradas
            if (this.mapSet.size > maxSize) {
                this.logger.log(`[${new Date().toISOString()}] Cleaning mapSet: ${this.mapSet.size} -> 0`)
                this.mapSet.clear()
            }
        }, 600000) // 10 minutos

        // Never keep the event loop alive because of a housekeeping timer
        if (typeof this.cleanupInterval.unref === 'function') {
            this.cleanupInterval.unref()
        }
    }

    private cleanup(): Promise<void> {
        if (this.cleanupPromise) return this.cleanupPromise
        this.isCleaned = true

        if (this.cleanupInterval) clearInterval(this.cleanupInterval)
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
        if (this.sessionCleanupTimer) clearInterval(this.sessionCleanupTimer)
        this.cleanupInterval = undefined
        this.reconnectTimer = undefined
        this.sessionCleanupTimer = undefined
        this.reconnectInProgress = false

        for (const { event, handler } of this.signalHandlers) process.removeListener(event, handler)
        this.signalHandlers = []

        // Every concurrent caller waits for the same complete teardown.
        this.cleanupPromise = this.performCleanup()
        return this.cleanupPromise
    }

    private async performCleanup(): Promise<void> {
        try {
            // Initialization may be suspended in auth/version/pairing I/O. Its
            // stopping guards prevent a late socket; keep logs open until it settles.
            if (this.reconnectTask) await this.reconnectTask
            if (this.initPromise) await this.initPromise.catch((error) => this.logger.error(error))

            if (this.vendor) {
                try {
                    // Baileys end() owns WebSocket closure and is async at runtime.
                    // Do not close twice, and ignore its connection.update during shutdown.
                    await this.vendor.end?.(undefined)
                } catch (error) {
                    this.logger.error('[Baileys] Socket shutdown failed:', error)
                }
            }

            this.msgRetryCounterCache?.close()
            this.msgRetryCounterCache = undefined
            this.userDevicesCache?.close()
            this.userDevicesCache = undefined
            this.messageCache?.close()
            this.messageCache = undefined
            this.mapSet.clear()
            this.idsDuplicates.clear()

            if (this.lidCache?.close) {
                await this.lidCache.close().catch((error) => this.logger.error('[Baileys] LID flush failed:', error))
            }

            const server = this.server?.server
            if (server?.listening) {
                await new Promise<void>((resolve, reject) => {
                    server.close((error) => (error ? reject(error) : resolve()))
                    server.closeIdleConnections?.()
                }).catch((error) => this.logger.error('[Baileys] HTTP shutdown failed:', error))
            }
            this.logger.log(`[${new Date().toISOString()}] Recursos limpiados correctamente`)
        } catch (error) {
            console.error('Error durante cleanup:', error)
        } finally {
            // Await the actual flush/close, not just the call to end().
            if (this.logStream && typeof this.logStream.end === 'function') {
                const flushed = finished(this.logStream)
                this.logStream.end()
                await flushed.catch((error) => console.error('[Baileys] Log shutdown failed:', error))
            }
        }
    }

    /**
     * Releases every resource held by the provider: socket, caches, timers,
     * LID cache flush and log stream. Idempotent.
     *
     * Hosts that embed the provider should call this from their own shutdown
     * path, since the provider does not capture process signals by default.
     */
    public destroy(): Promise<void> {
        return this.cleanup()
    }

    public start(...args: Parameters<ProviderClass['start']>): void {
        if (!this.isCleaned) super.start(...args)
    }

    protected listenOnEvents(vendor: any): void {
        if (!this.isCleaned) super.listenOnEvents(vendor)
    }

    public async releaseSessionFiles() {
        const NAME_DIR_SESSION = `${this.globalVendorArgs.name}_sessions`
        await cleanSessionFiles(NAME_DIR_SESSION)
    }

    protected beforeHttpServerInit(): void {
        this.server = this.server
            .use((req: any, _: any, next: () => any) => {
                req['globalVendorArgs'] = this.globalVendorArgs
                return next()
            })
            .get('/', this.indexHome)
    }

    protected afterHttpServerInit(): void {}

    public indexHome: polka.Middleware = (req, res) => {
        const notReady = () => {
            if (res.headersSent) {
                res.destroy()
                return
            }
            res.writeHead(404, { 'Content-Type': 'text/html' })
            res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta http-equiv="refresh" content="5">
                    <title>QR Not Ready</title>
                </head>
                <body>
                    <p>QR code is not ready yet. The page will automatically refresh in 5 seconds.</p>
                </body>
                </html>
            `)
        }

        try {
            const botName = req[this.idBotName]
            const qrPath = join(process.cwd(), `${botName}.qr.png`)

            const fileStream = createReadStream(qrPath)
            fileStream.once('error', notReady)
            // Delay headers until the file is open so ENOENT/EACCES can return 404.
            fileStream.once('open', () => {
                if (res.destroyed) return fileStream.destroy()
                res.writeHead(200, { 'Content-Type': 'image/png' })
                fileStream.pipe(res)
            })
            res.once('close', () => fileStream.destroy())
        } catch (e) {
            notReady()
        }
    }

    protected getMessage = async (key: { remoteJid: string; id: string }): Promise<proto.IMessage | undefined> => {
        if (!key.id) return undefined

        // Baileys contract: `undefined` on miss so it can trigger a retry.
        // Returning `{}` makes Baileys believe the message was found (H3).
        return this.messageCache?.get<proto.IMessage>(`msg:${key.id}`)
    }

    /** Cache outgoing messages so getMessage can answer retry/poll lookups (T1). */
    private cacheOutgoingMessage(sent: any): any {
        if (sent?.key?.id && sent?.message) {
            this.messageCache?.set(`msg:${sent.key.id}`, sent.message)
        }
        return sent
    }

    protected saveCredsGlobal: (() => Promise<void>) | null = null

    /**
     * Iniciar todo Bailey
     */
    protected initVendor = (): Promise<WASocket['ev'] | undefined> => {
        if (this.isCleaned) return Promise.resolve(undefined)
        if (this.initPromise) return this.initPromise
        this.initPromise = this.createVendor().finally(() => {
            this.initPromise = undefined
        })
        return this.initPromise
    }

    private createVendor = async (): Promise<WASocket['ev'] | undefined> => {
        const NAME_DIR_SESSION = `${this.globalVendorArgs.name}_sessions`
        const { state, saveCreds } = await useMultiFileAuthState(NAME_DIR_SESSION)
        if (this.isCleaned) return
        // T10: configurable; default 'error' so decrypt failures (Bad MAC, No
        // session) are visible instead of hidden by 'fatal'.
        const loggerBaileys = pino({ level: this.globalVendorArgs.baileysLogLevel ?? 'error' })

        this.saveCredsGlobal = saveCreds

        try {
            if (this.globalVendorArgs.useBaileysStore) {
                if (this.globalVendorArgs.timeRelease > 0 && !this.sessionCleanupTimer) {
                    const timer = await releaseTmp(NAME_DIR_SESSION, this.globalVendorArgs.timeRelease)
                    if (this.isCleaned) {
                        if (timer) clearInterval(timer)
                        return
                    }
                    this.sessionCleanupTimer = timer
                }
            }
        } catch (e) {
            // Best-effort cleanup: never spawn a second socket from here
            this.logger.log(e)
        }

        try {
            let version: WAVersion
            try {
                const waVersion = await fetchLatestWaWebVersion({})
                version = waVersion.version
                this.logger.log(`[Baileys] Using live WA Web version: ${version.join('.')}`)
            } catch (err) {
                try {
                    const baileysVersion = await fetchLatestBaileysVersion()
                    version = baileysVersion.version
                    this.logger.log(`[Baileys] Fallback to Baileys repo WA version: ${version.join('.')}`)
                } catch (e) {
                    // T9: keep in sync with the WA Web version shipped by the
                    // pinned Baileys release (rc14 default).
                    version = [2, 3000, 1043857760] as WAVersion
                    this.logger.log(`[Baileys] Fallback to hardcoded WA version: ${version.join('.')}`)
                }
            }
            if (this.isCleaned) return
            const sock = makeWASocketOther({
                logger: loggerBaileys,
                version,
                printQRInTerminal: false,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, loggerBaileys),
                },
                browser: this.globalVendorArgs.browser as WABrowserDescription,
                syncFullHistory: false,
                markOnlineOnConnect: false,
                generateHighQualityLinkPreview: true,
                getMessage: this.getMessage,
                msgRetryCounterCache: this.msgRetryCounterCache as any,
                userDevicesCache: this.userDevicesCache as any,
                retryRequestDelayMs: 1000, // Mayor delay entre reintentos
                connectTimeoutMs: 60_000, // 1 minuto timeout conexión
                keepAliveIntervalMs: 10_000, // Keep alive cada 10 segundos
                qrTimeout: 40_000, // 40 segundos para QR
                defaultQueryTimeoutMs: 60_000, // 1 minuto para queries
                emitOwnEvents: false, // No emitir eventos propios
                shouldIgnoreJid: (jid: string) => {
                    // T15 option C: `allowGroups` takes precedence over the legacy
                    // `groupsIgnore` for group chats only; broadcasts keep the old rule.
                    if (isJidGroup(jid))
                        return this.globalVendorArgs.allowGroups ? false : this.globalVendorArgs.groupsIgnore
                    if (isJidBroadcast(jid)) return this.globalVendorArgs.groupsIgnore
                    return false
                },
                ...this.globalVendorArgs,
            })

            this.vendor = sock

            // T6: register listeners BEFORE any await (pairing can take seconds
            // and events arriving meanwhile would be lost).
            this.attachSocketListeners(sock, saveCreds)

            if (this.globalVendorArgs.usePairingCode && !sock.authState.creds.registered) {
                if (this.globalVendorArgs.phoneNumber) {
                    // T6: request the code with the cleaned E.164 number, not the raw input
                    const phoneNumberClean = utils.removePlus(this.globalVendorArgs.phoneNumber).replace(/\D/g, '')
                    const code = await sock.requestPairingCode(phoneNumberClean)
                    if (this.isCleaned) return
                    await utils.delay(2000)
                    if (this.isCleaned) return
                    this.emit('require_action', {
                        title: '⚡⚡ ACTION REQUIRED ⚡⚡',
                        instructions: [
                            `Accept the WhatsApp notification from ${this.globalVendorArgs.phoneNumber} on your phone 👌`,
                            `The pairing code is: ${code}`,
                            `Need help: https://link.codigoencasa.com/DISCORD`,
                        ],
                        payload: { code },
                    })
                } else {
                    this.emit('auth_failure', [
                        `The phone number has not been defined, please add it`,
                        `Restart the BOT`,
                        `You can also check a log that has been created baileys.log`,
                        `Need help: https://link.codigoencasa.com/DISCORD`,
                    ])
                }
            }

            return sock.ev
        } catch (e) {
            this.logger.log(e)
            this.emit('auth_failure', [
                `Something unexpected has occurred, do not panic`,
                `Restart the BOT`,
                `You can also check a log that has been created baileys.log`,
                `Need help: https://link.codigoencasa.com/DISCORD`,
            ])
        }
    }

    private attachSocketListeners(sock: WASocket, saveCreds: () => Promise<void>): void {
        {
            sock.ev.on('connection.update', async (update: { connection: any; lastDisconnect: any; qr: any }) => {
                if (this.isCleaned || this.vendor !== sock) return
                const { connection, lastDisconnect, qr } = update

                this.logger.log(`[${new Date().toISOString()}] Connection update: ${connection}`)

                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
                const reason = lastDisconnect?.error?.message

                /** Connection closed for various reasons */
                if (connection === 'close') {
                    this.logger.log(
                        `[${new Date().toISOString()}] Connection closed. Status: ${statusCode}, Reason: ${reason}`
                    )

                    // T7: never delete auth material automatically. The host
                    // decides; opt-in via `clearAuthOnLogout` restores old behavior.
                    if (statusCode === DisconnectReason.loggedOut) {
                        this.logger.log(`[${new Date().toISOString()}] Logged out by WhatsApp; session preserved`)
                        if (this.globalVendorArgs.clearAuthOnLogout) {
                            const PATH_BASE = join(process.cwd(), `${this.globalVendorArgs.name}_sessions`)
                            await emptyDirSessions(PATH_BASE)
                            this.reconnectAttempts = 0
                            await this.delayedReconnect()
                            return
                        }
                        this.emit('auth_failure', [
                            `WhatsApp logged this session out (401)`,
                            `Auth files were preserved in ${this.globalVendorArgs.name}_sessions`,
                            `Unlink the device manually or set clearAuthOnLogout: true to auto-reset`,
                            `Need help: https://link.codigoencasa.com/DISCORD`,
                        ])
                        return
                    }

                    // T8: a replaced connection means another live socket owns the
                    // session; reconnecting starts a tug-of-war and risks a ban.
                    if (statusCode === DisconnectReason.connectionReplaced) {
                        this.logger.log(
                            `[${new Date().toISOString()}] Connection replaced by another socket; not reconnecting`
                        )
                        this.emit('auth_failure', [
                            `Connection replaced (440): another instance opened this session`,
                            `Stop the other instance before restarting this one`,
                            `Check baileys.log for details`,
                        ])
                        return
                    }

                    // Casos donde debemos reconectar con backoff
                    if (this.shouldReconnect(statusCode)) {
                        await this.delayedReconnect()
                        return
                    }

                    // Casos críticos - emitir error
                    this.logger.log(`[${new Date().toISOString()}] Critical error, stopping reconnection attempts`)
                    this.emit('auth_failure', [
                        `Critical connection error: ${reason}`,
                        `Status code: ${statusCode}`,
                        `Check baileys.log for details`,
                        `Need help: https://link.codigoencasa.com/DISCORD`,
                    ])
                }

                /** Connection opened successfully */
                if (connection === 'open') {
                    this.logger.log(`[${new Date().toISOString()}] Connection opened successfully`)
                    this.reconnectAttempts = 0 // Reset counter on successful connection
                    this.reconnectDelay = 1000 // Reset delay

                    const parseNumber = `${sock?.user?.id}`.split(':').shift()
                    const host = { ...sock?.user, phone: parseNumber }
                    this.globalVendorArgs.host = host
                    this.emit('ready', true)
                    this.emit('host', host)
                }

                /** QR Code */
                if (qr && !this.globalVendorArgs.usePairingCode) {
                    this.logger.log(`[${new Date().toISOString()}] QR Code received`)
                    this.emit('require_action', {
                        title: '⚡⚡ ACTION REQUIRED ⚡⚡',
                        instructions: [
                            `You must scan the QR Code`,
                            `Remember that the QR code updates every minute`,
                            `Need help: https://link.codigoencasa.com/DISCORD`,
                            `Official documentation: https://www.builderbot.app`,
                        ],
                        payload: { qr },
                    })
                    await baileyGenerateImage(qr, `${this.globalVendorArgs.name}.qr.png`)
                }
            })

            sock.ev.on('creds.update', async () => {
                if (!this.isCleaned) await saveCreds()
            })
        }
    }

    /**
     * Map native events that the Provider class expects
     * to have a standard set of events
     * @returns
     */
    protected busEvents = (): {
        event: keyof BaileysEventMap
        func: (arg?: any, arg2?: any) => any
    }[] => [
        {
            event: 'messages.upsert',
            func: async (argFromProvider) => {
                const { messages, type } = argFromProvider as {
                    type: MessageUpsertType
                    messages: WAMessage[]
                }
                if (type !== 'notify') return

                const pingMessageSync = async (_messageCtx: proto.IWebMessageInfo) => {
                    if (!this.mapSet.has(_messageCtx?.key?.remoteJid)) {
                        try {
                            this.mapSet.add(_messageCtx?.key?.remoteJid)
                            const jid = _messageCtx?.key?.remoteJid

                            // Removed readMessages() call - Baileys v7 no longer sends ACKs to prevent bans
                            await this.vendor.sendMessage(jid, {
                                text: this.globalVendorArgs.experimentalSyncMessage,
                            })
                        } catch (e) {
                            this.logger.log(e)
                        }
                    }
                }

                for (const messageCtx of messages) {
                    // Almacenar mensaje en cache para poder recuperarlo en getMessage (soluciona iOS "this message can take a while")
                    if (messageCtx?.key?.id && messageCtx?.message) {
                        this.messageCache?.set(`msg:${messageCtx.key.id}`, messageCtx.message)
                    }

                    // Aprender mapeo LID→PN desde mensaje entrante (async, no bloqueante)
                    this.cacheLidFromMessage(messageCtx).catch(() => {})

                    if (
                        messageCtx?.messageStubParameters?.length &&
                        messageCtx.messageStubParameters[0].includes('absent')
                    )
                        continue
                    if (
                        messageCtx?.messageStubParameters?.length &&
                        messageCtx.messageStubParameters[0].includes('No session')
                    )
                        continue
                    if (
                        messageCtx?.messageStubParameters?.length &&
                        messageCtx.messageStubParameters[0].includes('Bad MAC')
                    )
                        continue
                    if (
                        messageCtx?.messageStubParameters?.length &&
                        messageCtx.messageStubParameters[0].includes('Invalid')
                    ) {
                        if (this.globalVendorArgs.fallBackAction) {
                            try {
                                await this.globalVendorArgs.fallBackAction(messageCtx)
                            } catch (error) {
                                continue
                            }
                            continue
                        }

                        if (
                            this.globalVendorArgs.experimentalSyncMessage &&
                            this.globalVendorArgs.experimentalSyncMessage.length
                        ) {
                            if (baileyIsValidNumber(messageCtx?.key?.remoteJid)) {
                                await pingMessageSync(messageCtx)
                            }
                            continue
                        }
                        continue
                    }
                    // if (((messageCtx?.message?.protocolMessage?.type) as unknown as string) === 'EPHEMERAL_SETTING') continue

                    const textToBody =
                        messageCtx?.message?.ephemeralMessage?.message?.extendedTextMessage?.text ??
                        messageCtx?.message?.extendedTextMessage?.text ??
                        messageCtx?.message?.conversation

                    if (textToBody) {
                        if (textToBody === 'requestPlaceholder' && !(messageCtx as any).requestId) {
                            try {
                                if (this.vendor.requestPlaceholderResend) {
                                    const messageId = await this.vendor.requestPlaceholderResend(messageCtx.key)
                                    this.logger.log(
                                        `[${new Date().toISOString()}] Requested placeholder resync, id=${messageId}`
                                    )
                                }
                                continue // No procesar como mensaje normal
                            } catch (e) {
                                this.logger.log(`[${new Date().toISOString()}] Error requesting placeholder resync:`, e)
                            }
                        }

                        if (textToBody === 'onDemandHistSync') {
                            try {
                                if (this.vendor.fetchMessageHistory) {
                                    const messageId = await this.vendor.fetchMessageHistory(
                                        50,
                                        messageCtx.key,
                                        messageCtx.messageTimestamp
                                    )
                                    this.logger.log(
                                        `[${new Date().toISOString()}] Requested on-demand sync, id=${messageId}`
                                    )
                                }
                                continue // No procesar como mensaje normal
                            } catch (e) {
                                this.logger.log(`[${new Date().toISOString()}] Error requesting history sync:`, e)
                            }
                        }

                        if ((messageCtx as any).requestId) {
                            this.logger.log(
                                `[${new Date().toISOString()}] Message received from phone, id=${
                                    (messageCtx as any).requestId
                                }`,
                                messageCtx
                            )
                        }
                    }

                    // Buscar siempre el que tenga formato @s.whatsapp.net (puede estar en remoteJid o remoteJidAlt)
                    const remoteJid = (messageCtx?.key as any)?.remoteJid
                    const remoteJidAlt = (messageCtx?.key as any)?.remoteJidAlt
                    // Never fabricate a PN from a LID: keep the @lid JID and let
                    // resolveNumber/lidCache resolve it later (T3, RFC 0002 §9.3).
                    const fromParse = remoteJid?.includes('@lid') ? remoteJidAlt || remoteJid : remoteJid

                    const isGroupMessage = `${remoteJid ?? ''}`.includes('@g.us')

                    const messageKey = (messageCtx?.key ?? {}) as any

                    let payload = {
                        ...messageCtx,
                        body: textToBody,
                        name: messageCtx?.pushName,
                        from: baileyCleanNumber(fromParse),
                        // WhatsApp usernames (Baileys >= rc13, upstream PR #2480).
                        // A user with a username is addressed by @lid, so `from`
                        // may be a LID: treat it as the stable key and read the
                        // username from here instead of parsing the JID.
                        username: messageKey.remoteJidUsername,
                        // W1: expose fromMe at the root so consumers can filter
                        // self-messages without reaching into `key` (matches Meta).
                        fromMe: Boolean(messageKey.fromMe),
                        // T15 option C: for groups, `from` is the group JID and the
                        // author travels in `participant`/`sender`.
                        ...(isGroupMessage
                            ? {
                                  participant: messageKey.participant,
                                  sender: messageKey.participant,
                                  participantUsername: messageKey.participantUsername,
                              }
                            : {}),
                    }

                    if (messageCtx.message?.locationMessage) {
                        const { degreesLatitude, degreesLongitude } = messageCtx.message.locationMessage
                        if (typeof degreesLatitude === 'number' && typeof degreesLongitude === 'number') {
                            payload = {
                                ...payload,
                                body: utils.generateRefProvider('_event_location_'),
                            }
                        }
                    }

                    if (messageCtx.message?.videoMessage) {
                        payload = {
                            ...payload,
                            body: utils.generateRefProvider('_event_media_'),
                        }
                    }

                    if (messageCtx.message?.stickerMessage) {
                        payload = {
                            ...payload,
                            body: utils.generateRefProvider('_event_media_'),
                        }
                    }

                    if (messageCtx.message?.imageMessage) {
                        payload = {
                            ...payload,
                            body: utils.generateRefProvider('_event_media_'),
                        }
                    }

                    if (messageCtx.message?.documentMessage || messageCtx.message?.documentWithCaptionMessage) {
                        payload = {
                            ...payload,
                            body: utils.generateRefProvider('_event_document_'),
                        }
                    }

                    if (messageCtx.message?.audioMessage) {
                        payload = {
                            ...payload,
                            body: utils.generateRefProvider('_event_voice_note_'),
                        }
                    }

                    if (messageCtx.message?.orderMessage) {
                        payload = {
                            ...payload,
                            body: utils.generateRefProvider('_event_order_'),
                        }
                    }

                    // W2: contact cards previously emitted with body undefined, so no
                    // flow could match them. `_event_contacts_` matches Meta and the
                    // core CONTACTS event.
                    if (messageCtx.message?.contactMessage || messageCtx.message?.contactsArrayMessage) {
                        payload = {
                            ...payload,
                            body: utils.generateRefProvider('_event_contacts_'),
                        }
                    }

                    if (payload.from === 'status@broadcast') continue
                    payload.from = baileyCleanNumber(payload.from, true)

                    if (this.globalVendorArgs.writeMyself === 'none' && payload?.key?.fromMe) continue
                    if (
                        this.globalVendorArgs.host?.phone !== payload.from &&
                        payload?.key?.fromMe &&
                        !['both'].includes(this.globalVendorArgs.writeMyself)
                    )
                        continue
                    if (
                        this.globalVendorArgs.host?.phone === payload.from &&
                        !['both', 'host'].includes(this.globalVendorArgs.writeMyself)
                    )
                        continue

                    // T15 option C: groups only pass when explicitly enabled.
                    const isAllowedGroup = this.globalVendorArgs.allowGroups && isGroupMessage
                    if (!isAllowedGroup && !baileyIsValidNumber(payload.from)) {
                        continue
                    }

                    const btnCtx = payload?.message?.buttonsResponseMessage?.selectedDisplayText
                    if (btnCtx) payload.body = btnCtx

                    const listRowId = payload?.message?.listResponseMessage?.title
                    if (listRowId) payload.body = listRowId

                    const processDuplicate = () => {
                        if (messageCtx?.key?.id) {
                            const idWs = `${messageCtx.key.id}__${payload.from}`
                            const now = Date.now()
                            const expiresAt = this.idsDuplicates.get(idWs)
                            if (expiresAt !== undefined && expiresAt > now) return false
                            if (this.idsDuplicates.size >= BaileysProvider.DEDUPE_MAX_ENTRIES) {
                                const oldest = this.idsDuplicates.keys().next().value
                                if (oldest !== undefined) this.idsDuplicates.delete(oldest)
                            }
                            this.idsDuplicates.set(idWs, now + BaileysProvider.DEDUPE_TTL_MS)
                        }
                        return true
                    }

                    if (processDuplicate()) {
                        this.emit('message', payload)
                    }
                }
            },
        },
        {
            event: 'messages.update',
            func: async (message) => {
                for (const { key, update } of message) {
                    if (update.pollUpdates) {
                        const pollCreation = await this.getMessage(key)
                        if (pollCreation) {
                            const pollMessage = getAggregateVotesInPollMessage({
                                message: pollCreation,
                                pollUpdates: update.pollUpdates,
                            })
                            const [messageCtx] = message

                            if (
                                !messageCtx ||
                                !messageCtx.update ||
                                !messageCtx.update.pollUpdates ||
                                messageCtx.update.pollUpdates.length === 0
                            ) {
                                continue
                            }

                            const payload = {
                                ...messageCtx,
                                body: pollMessage.find((poll) => poll.voters.length > 0)?.name || '',
                                from: baileyCleanNumber(key.remoteJid, true),
                                voters: pollCreation,
                                type: 'poll',
                            }
                            this.emit('message', payload)
                        }
                    }
                }
            },
        },
        {
            event: 'call',
            func: async ([call]) => {
                if (call.status === 'offer') {
                    const payload = {
                        from: baileyCleanNumber(call.from, true),
                        body: utils.generateRefProvider('_event_call_'),
                        call,
                    }

                    this.emit('message', payload)
                    // Opcional: Rechazar automáticamente la llamada
                    // await this.vendor.rejectCall(call.id, call.from)
                }
            },
        },
    ]

    /**
     *
     * @param {string} number
     * @param {string} text
     * @param {string} footer
     * @param {Array} poll
     * @example await sendMessage("+XXXXXXXXXXX", { poll: { "name": "You accept terms", "values": [ "Yes", "Not"], "selectableCount": 1 })
     */

    sendPoll = async (numberIn: string, text: string, poll: { options: string[]; multiselect: any }) => {
        const numberClean = baileyCleanNumber(numberIn)

        if (poll.options.length < 2) return false

        const pollMessage: PollMessageOptions = {
            name: text,
            values: poll.options,
            selectableCount: poll?.multiselect === undefined ? 1 : poll?.multiselect ? 1 : 0,
        }
        return this.vendor.sendMessage(numberClean, {
            poll: pollMessage,
        })
    }

    /**
     * @param {string} orderId
     * @param {string} orderToken
     * @example await getOrderDetails('order-id', 'order-token')
     */
    getOrderDetails = async (orderId: string, orderToken: string) => {
        const orderDetails = await this.vendor.getOrderDetails(orderId, orderToken)
        return orderDetails
    }

    // =============================================================================
    // LID CACHE INTEGRATION
    // =============================================================================

    /**
     * Inicializa el caché LID/PN usando el factory.
     * @returns Instancia de LidCache configurada según globalVendorArgs
     */
    private initializeLidCache(): LidCache {
        return createLidCache({
            strategy: this.globalVendorArgs.lidCache,
            sessionName: this.globalVendorArgs.name,
            ttlSeconds: this.globalVendorArgs.lidCacheTtl,
            logger: this.logger,
        })
    }

    /**
     * Delegates to the standalone utility for caching LID→PN from messages.
     * This wrapper maintains the method signature for internal use while
     * leveraging the exported function for reusability.
     */
    private async cacheLidFromMessage(messageCtx: MessageContext | unknown): Promise<void> {
        // Type guard: ensure the message context has the expected structure
        if (!isMessageContext(messageCtx)) {
            this.logger.debug?.('Invalid message context for LID caching')
            return
        }
        return extractAndCacheLidFromMessage(this.lidCache, messageCtx)
    }

    /**
     * Accede al lidMapping del signalRepository de Baileys.
     */
    private get lidMapping() {
        return (this.vendor as any)?.signalRepository?.lidMapping ?? null
    }

    /**
     * Obtener LID (Local Identifier) para un número de teléfono (PN)
     * @param phoneNumber - JID con formato '1234567890@s.whatsapp.net'
     */
    getLIDForPN = async (phoneNumber: string): Promise<string | null> => {
        try {
            return (await this.lidMapping?.getLIDForPN?.(phoneNumber)) ?? null
        } catch (e) {
            this.logger.log(`[${new Date().toISOString()}] Error getting LID for PN:`, e)
            return null
        }
    }

    /**
     * Obtener número de teléfono (PN) para un LID (Local Identifier).
     * Delegates to the standalone utility with Baileys lidMapping as fallback.
     *
     * @param lid - JID con formato '16424005304394@lid'
     * @returns Phone number en formato '1234567890@s.whatsapp.net', o null si no se resuelve
     */
    getPNForLID = async (lid: string | LidJid): Promise<string | null> => {
        // Normalize to branded type if valid
        const lidJid = typeof lid === 'string' ? asLidJid(lid) : lid
        if (!lidJid) return null

        return resolveLidToPn(
            this.lidCache,
            (id) => this.lidMapping?.getPNForLID?.(id) ?? Promise.resolve(null),
            this.logger,
            lidJid
        )
    }

    /**
     * Normaliza un número entrante a un JID válido para envío.
     * Si es un @lid, intenta resolver a @s.whatsapp.net; si falla, envía al LID directamente.
     */
    private resolveNumber = async (numberIn: string): Promise<string> => {
        const jid = baileyCleanNumber(`${numberIn}`)

        if (!jid.includes('@lid')) return jid

        const resolved = await this.getPNForLID(jid)
        if (resolved) {
            this.logger.log(`[${new Date().toISOString()}] LID resolved: ${jid} -> ${resolved}`)
            return baileyCleanNumber(resolved)
        }

        return jid
    }

    /**
     * @param {string} number
     * @param {string} message
     * @example await sendMessage('+XXXXXXXXXXX', 'https://dominio.com/imagen.jpg' | 'img/imagen.jpg')
     */

    sendMedia = async (number: string, imageUrl: string, text: string) => {
        const fileDownloaded = await utils.generalDownload(imageUrl)
        const mimeType = mime.lookup(fileDownloaded)
        if (`${mimeType}`.includes('image')) return this.sendImage(number, fileDownloaded, text)
        if (`${mimeType}`.includes('video')) return this.sendVideo(number, fileDownloaded, text)
        if (`${mimeType}`.includes('audio')) {
            const fileOpus = await utils.convertAudio(fileDownloaded)
            return this.sendAudio(number, fileOpus)
        }
        return this.sendFile(number, fileDownloaded, text)
    }

    /**
     * Enviar imagen
     * @param {*} number
     * @param {*} imageUrl
     * @param {*} text
     * @returns
     */
    sendImage = async (number: string, filePath: string, text: any) => {
        const payload: AnyMediaMessageContent = {
            image: { url: filePath },
            caption: text,
        }
        return this.cacheOutgoingMessage(await this.vendor.sendMessage(await this.resolveNumber(number), payload))
    }

    /**
     * Enviar video
     * @param {*} number
     * @param {*} imageUrl
     * @param {*} text
     * @returns
     */
    sendVideo = async (number: string, filePath: PathOrFileDescriptor, text: any) => {
        const payload: AnyMediaMessageContent = {
            video: readFileSync(filePath),
            caption: text,
            gifPlayback: this.globalVendorArgs.gifPlayback,
        }
        return this.cacheOutgoingMessage(await this.vendor.sendMessage(await this.resolveNumber(number), payload))
    }

    /**
     * Enviar audio
     * @alpha
     * @param {string} number
     * @param {string} message
     * @param {boolean} voiceNote optional
     * @example await sendMessage('+XXXXXXXXXXX', 'audio.mp3')
     */

    sendAudio = async (number: string, audioPath: string, isPTT = true) => {
        const payload: AnyMediaMessageContent = {
            audio: await readFile(audioPath),
            ptt: isPTT,
            mimetype: 'audio/ogg; codecs=opus',
        }
        return this.cacheOutgoingMessage(await this.vendor.sendMessage(await this.resolveNumber(number), payload))
    }

    /**
     *
     * @param {string} number
     * @param {string} message
     * @returns
     */
    sendText = async (number: string, message: string) => {
        const payload: AnyMessageContent = { text: message }
        return this.cacheOutgoingMessage(await this.vendor.sendMessage(await this.resolveNumber(number), payload))
    }

    /**
     *
     * @param {string} number
     * @param {string} filePath
     * @example await sendMessage('+XXXXXXXXXXX', './document/file.pdf')
     */

    sendFile = async (number: string, filePath: string, text: string) => {
        const mimeType = mime.lookup(filePath)
        const fileName = basename(filePath)

        const payload: AnyMessageContent = {
            document: { url: filePath },
            mimetype: `${mimeType}`,
            fileName: fileName,
            caption: text,
        }

        return this.cacheOutgoingMessage(await this.vendor.sendMessage(await this.resolveNumber(number), payload))
    }

    /**
     * @deprecated Buttons are not available in this provider, please use sendButtons instead
     * @private
     * @param {string} number
     * @param {string} text
     * @param {string} footer
     * @param {Array} buttons
     * @example await sendMessage("+XXXXXXXXXXX", "Your Text", "Your Footer", [{"buttonId": "id", "buttonText": {"displayText": "Button"}, "type": 1}])
     */

    sendButtons = async (number: string, text: string, buttons: Button[]) => {
        this.emit('notice', {
            title: 'DEPRECATED',
            instructions: [
                `Currently sending buttons is not available with this provider`,
                `this function is available with Meta or Twilio`,
            ],
        })
        const numberClean = baileyCleanNumber(number)
        const templateButtons = buttons.map((btn: { body: any }, i: any) => ({
            buttonId: `id-btn-${i}`,
            buttonText: { displayText: btn.body },
            type: 1,
        }))

        const buttonMessage = {
            text,
            footer: '',
            buttons: templateButtons,
            headerType: 1,
        }

        return this.vendor.sendMessage(await this.resolveNumber(numberClean), buttonMessage)
    }

    /**
     * TODO: Necesita terminar de implementar el sendMedia y sendButton guiarse:
     * https://github.com/leifermendez/bot-whatsapp/blob/4e0fcbd8347f8a430adb43351b5415098a5d10df/packages/provider/src/web-whatsapp/index.js#L165
     * @param {string} number
     * @param {string} message
     * @example await sendMessage('+XXXXXXXXXXX', 'Hello World')
     */

    sendMessage = async (numberIn: string, message: string, options?: SendOptions): Promise<any> => {
        options = { ...(options ?? {}), ...(options?.['options'] ?? {}) }
        const number = await this.resolveNumber(numberIn)

        if (options.buttons?.length) return this.sendButtons(number, message, options.buttons)
        if (options.media) return this.sendMedia(number, options.media, message)
        return this.sendText(number, message)
    }

    /**
     * @param {string} remoteJid
     * @param {string} latitude
     * @param {string} longitude
     * @param {any} messages
     * @example await sendLocation("xxxxxxxxxxx@c.us" || "xxxxxxxxxxxxxxxxxx@g.us", "xx.xxxx", "xx.xxxx", messages)
     */

    sendLocation = async (remoteJid: string, latitude: any, longitude: any, messages: any = null) => {
        await this.vendor.sendMessage(
            await this.resolveNumber(remoteJid),
            {
                location: {
                    degreesLatitude: latitude,
                    degreesLongitude: longitude,
                },
            },
            { quoted: messages }
        )

        return { status: 'success' }
    }

    /**
     * @param {string} remoteJid
     * @param {string} contactNumber
     * @param {string} displayName
     * @param {string} orgName
     * @param {any} messages - optional
     * @example await sendContact("xxxxxxxxxxx@c.us" || "xxxxxxxxxxxxxxxxxx@g.us", "+xxxxxxxxxxx", "Robin Smith", messages)
     */

    sendContact = async (
        remoteJid: any,
        contactNumber: { replaceAll: (arg0: string, arg1: string) => any },
        displayName: string,
        orgName: string,
        messages: any = null
    ) => {
        const cleanContactNumber = contactNumber.replaceAll(' ', '')
        const waid = cleanContactNumber.replace('+', '')

        const vcard =
            'BEGIN:VCARD\n' +
            'VERSION:3.0\n' +
            `FN:${displayName}\n` +
            `ORG:${orgName};\n` +
            `TEL;type=CELL;type=VOICE;waid=${waid}:${cleanContactNumber}\n` +
            'END:VCARD'

        await this.vendor.sendMessage(
            await this.resolveNumber(remoteJid),
            {
                contacts: {
                    displayName: '.',
                    contacts: [{ vcard }],
                },
            },
            { quoted: messages }
        )

        return { status: 'success' }
    }

    /**
     * @param {string} remoteJid
     * @param {string} WAPresence
     * @example await sendPresenceUpdate("xxxxxxxxxxx@c.us" || "xxxxxxxxxxxxxxxxxx@g.us", "recording")
     */
    sendPresenceUpdate = async (remoteJid: any, WAPresence: any) => {
        await this.vendor.sendPresenceUpdate(WAPresence, await this.resolveNumber(remoteJid))
    }

    /**
     * @param {string} remoteJid
     * @param {string} url
     * @param {object} stickerOptions
     * @param {any} messages - optional
     * @example await sendSticker("xxxxxxxxxxx@c.us" || "xxxxxxxxxxxxxxxxxx@g.us", "https://dn/image.png" || "https://dn/image.gif" || "https://dn/image.mp4", {pack: 'User', author: 'Me'} messages)
     */

    sendSticker = async (
        remoteJid: any,
        url: string | Buffer,
        stickerOptions: Partial<IStickerOptions>,
        messages: any = null
    ) => {
        const sticker = new Sticker(url, {
            ...stickerOptions,
            quality: 50,
            type: 'crop',
        })

        const buffer = await sticker.toMessage()

        // Return + cache like every other sender so callers get the key and
        // getMessage can answer a retry (T16 finding).
        return this.cacheOutgoingMessage(
            await this.vendor.sendMessage(await this.resolveNumber(remoteJid), buffer, { quoted: messages })
        )
    }

    private getMimeType = (ctx: WAMessage): string | undefined => {
        const { message } = ctx
        if (!message) return undefined

        const { imageMessage, videoMessage, documentMessage, audioMessage, documentWithCaptionMessage } = message
        return (
            imageMessage?.mimetype ??
            audioMessage?.mimetype ??
            videoMessage?.mimetype ??
            documentMessage?.mimetype ??
            documentWithCaptionMessage?.message?.documentMessage?.mimetype
        )
    }

    private generateFileName = (extension: string): string => `file-${Date.now()}.${extension}`

    /**
     * Return Path absolute
     * @param ctx
     * @param options
     * @returns
     */
    saveFile = async (ctx: Partial<WAMessage & BotContext>, options?: { path: string }): Promise<string> => {
        const mimeType = this.getMimeType(ctx as WAMessage)
        if (!mimeType) throw new Error('MIME type not found')
        const extension = mime.extension(mimeType) as string
        // Pass ctx so Baileys can request a reupload on 410/404 (T5, upstream #2767)
        const buffer = await downloadMediaMessage(ctx as WAMessage, 'buffer', {}, {
            reuploadRequest: (msg: WAMessage) => this.vendor.updateMediaMessage(msg),
            logger: this.logger,
        } as any)
        const fileName = this.generateFileName(extension)

        const pathFile = join(options?.path ?? tmpdir(), fileName)
        await writeFile(pathFile, buffer)
        return resolve(pathFile)
    }

    private shouldReconnect(statusCode: number): boolean {
        // Lista de códigos donde SÍ debemos reconectar
        // T8: connectionReplaced (440) excluded — handled as auth_failure above
        const reconnectableCodes = [
            DisconnectReason.connectionClosed,
            DisconnectReason.connectionLost,
            DisconnectReason.timedOut,
            DisconnectReason.badSession,
            DisconnectReason.restartRequired,
            429, // Rate limited
            500, // Server error
            502, // Bad gateway
            503, // Service unavailable
            504, // Gateway timeout
        ]

        return (
            !this.isCleaned &&
            reconnectableCodes.includes(statusCode) &&
            this.reconnectAttempts < this.maxReconnectAttempts
        )
    }

    private async delayedReconnect(): Promise<void> {
        if (this.isCleaned || this.reconnectInProgress) return
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.log(
                `[${new Date().toISOString()}] Max reconnection attempts reached (${this.maxReconnectAttempts})`
            )
            this.emit('auth_failure', [
                `Maximum reconnection attempts reached`,
                `Please check your internet connection`,
                `Check baileys.log for details`,
                // T18: each reconnect creates a socket whose AsyncLocalStorage is
                // never released upstream (#2806); long-running hosts should recycle
                // the process after repeated reconnects.
                `After many reconnects, consider restarting the process (upstream memory leak #2806)`,
                `Need help: https://link.codigoencasa.com/DISCORD`,
            ])
            return
        }

        this.reconnectInProgress = true
        this.reconnectAttempts++
        // T8: exponential backoff with ±20% jitter to avoid thundering-herd retries
        const base = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000)
        const delay = Math.round(base * (0.8 + Math.random() * 0.4))

        this.logger.log(
            `[${new Date().toISOString()}] Reconnection attempt ${this.reconnectAttempts}/${
                this.maxReconnectAttempts
            } in ${delay}ms`
        )

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = undefined
            if (this.isCleaned) return
            this.reconnectTask = this.reconnectVendor().finally(() => {
                this.reconnectTask = undefined
            })
        }, delay)
        this.reconnectTimer.unref?.()
    }

    private async reconnectVendor(): Promise<void> {
        try {
            if (this.isCleaned) return
            if (this.vendor) await this.vendor.end(undefined)
            if (this.isCleaned) return
            const events = await this.initVendor()
            if (events && !this.isCleaned) this.listenOnEvents(events)
        } catch (error) {
            if (!this.isCleaned) this.logger.error('[Baileys] Reconnection failed:', error)
        } finally {
            this.reconnectInProgress = false
        }
    }
}

export { BaileysProvider }
