import { ProviderClass, utils } from '@builderbot/bot'
import type { BotContext, Button, SendOptions } from '@builderbot/bot/dist/types'
import type { Boom } from '@hapi/boom'
import { Console } from 'console'
import type { PathOrFileDescriptor } from 'fs'
import { createReadStream, createWriteStream, readFileSync } from 'fs'
import { writeFile } from 'fs/promises'
import mime from 'mime-types'
import NodeCache from 'node-cache'
import { tmpdir } from 'os'
import { join, basename, resolve } from 'path'
import pino from 'pino'
import type polka from 'polka'
import type { IStickerOptions } from 'wa-sticker-formatter'
import { Sticker } from 'wa-sticker-formatter'
import { WAVersion, WABrowserDescription } from 'whaileys'

import { releaseTmp } from './releaseTmp'
import {
    AnyMediaMessageContent,
    AnyMessageContent,
    BaileysEventMap,
    WAMessage,
    WASocket,
    MessageUpsertType,
    isJidGroup,
    isJidBroadcast,
    DisconnectReason,
    downloadMediaMessage,
    getAggregateVotesInPollMessage,
    makeCacheableSignalKeyStore,
    makeWASocketOther,
    proto,
    useMultiFileAuthState,
} from './sherpaWrapper'
import type { WALogger } from './sherpaWrapper'
import type { SherpaGlobalVendorArgs } from './type'
import {
    baileyGenerateImage,
    baileyCleanNumber,
    baileyCleanNumber as sherpaCleanNumber,
    baileyIsValidNumber as sherpaIsValidNumber,
    emptyDirSessions,
} from './utils'

class SherpaProvider extends ProviderClass<WASocket> {
    public globalVendorArgs: SherpaGlobalVendorArgs = {
        name: `bot`,
        gifPlayback: false,
        usePairingCode: false,
        browser: ['Windows', 'Chrome', 'Chrome 114.0.5735.198'] as WABrowserDescription,
        phoneNumber: null,
        useBaileysStore: true,
        port: 3000,
        timeRelease: 0, //21600000
        writeMyself: 'none',
        groupsIgnore: true,
        readStatus: false,
        experimentalStore: false,
        autoRefresh: 0,
        experimentalSyncMessage: undefined,
        fallBackAction: undefined,
    }

    private reconnectAttempts = 0
    private maxReconnectAttempts = 50
    private reconnectDelay = 1000 // 1 segundo inicial
    private healthCheckInterval?: ReturnType<typeof setInterval>
    private presenceInterval?: ReturnType<typeof setTimeout>
    private periodicCleanupInterval?: ReturnType<typeof setInterval>
    private reconnectTimer?: ReturnType<typeof setTimeout>
    private releaseTmpTimer?: NodeJS.Timeout
    private badSessionCount = 0

    msgRetryCounterCache?: NodeCache
    userDevicesCache?: NodeCache

    private logger: Console
    private logStream: NodeJS.WritableStream

    private idsDuplicates = []
    private mapSet = new Set()

    constructor(args: Partial<SherpaGlobalVendorArgs>) {
        super()

        this.logStream = createWriteStream(`${process.cwd()}/sherpa.log`, {
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

        this.globalVendorArgs = { ...this.globalVendorArgs, ...args }

        this.setupCleanupHandlers()
        this.setupPeriodicCleanup()
    }

    /**
     * Setup cleanup handlers
     * @description
     * - Remove existing listeners to prevent duplicates
     * - Add new listeners
     * - Add cleanup function to all listeners
     * - Add cleanup function to uncaughtException and unhandledRejection
     * - Add cleanup function to SIGINT, SIGTERM, SIGUSR1, SIGUSR2
     * - Add cleanup function to process.exit
     */
    private setupCleanupHandlers() {
        const cleanup = () => {
            this.logger.log(`[${new Date().toISOString()}] Iniciando limpieza de recursos...`)
            this.cleanup()
        }

        // Remove existing listeners to prevent duplicates
        process.removeAllListeners('SIGINT')
        process.removeAllListeners('SIGTERM')
        process.removeAllListeners('SIGUSR1')
        process.removeAllListeners('SIGUSR2')
        process.removeAllListeners('uncaughtException')
        process.removeAllListeners('unhandledRejection')

        process.on('SIGINT', cleanup)
        process.on('SIGTERM', cleanup)
        process.on('SIGUSR1', cleanup)
        process.on('SIGUSR2', cleanup)

        process.on('uncaughtException', (error) => {
            this.logger.log(`[${new Date().toISOString()}] Uncaught Exception:`, error)
            this.cleanup()
            process.exit(1)
        })

        process.on('unhandledRejection', (reason, promise) => {
            this.logger.log(`[${new Date().toISOString()}] Unhandled Rejection at:`, promise, 'reason:', reason)
        })
    }

    private setupPeriodicCleanup() {
        // Limpiar duplicados cada 10 minutos para evitar memory leaks
        this.periodicCleanupInterval = setInterval(() => {
            const maxSize = 1000
            if (this.idsDuplicates.length > maxSize) {
                this.logger.log(
                    `[${new Date().toISOString()}] Cleaning duplicates array: ${
                        this.idsDuplicates.length
                    } -> ${maxSize}`
                )
                this.idsDuplicates = this.idsDuplicates.slice(-maxSize) // Mantener solo los últimos 1000
            }

            // Limpiar mapSet si tiene demasiadas entradas
            if (this.mapSet.size > maxSize) {
                this.logger.log(`[${new Date().toISOString()}] Cleaning mapSet: ${this.mapSet.size} -> 0`)
                this.mapSet.clear()
            }
        }, 600000) // 10 minutos
    }

    private cleanup() {
        try {
            this.stopHealthCheck()
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer)
                this.reconnectTimer = undefined
            }
            if (this.releaseTmpTimer) {
                clearInterval(this.releaseTmpTimer)
                this.releaseTmpTimer = undefined
            }
            if (this.periodicCleanupInterval) {
                clearInterval(this.periodicCleanupInterval)
                this.periodicCleanupInterval = undefined
            }
            if (this.msgRetryCounterCache) {
                this.msgRetryCounterCache.close()
                this.msgRetryCounterCache = undefined
            }

            if (this.userDevicesCache) {
                this.userDevicesCache.close()
                this.userDevicesCache = undefined
            }

            this.mapSet.clear()
            this.idsDuplicates.length = 0

            // Log before closing the stream
            this.logger.log(`[${new Date().toISOString()}] Recursos limpiados correctamente`)

            if (this.logStream && typeof this.logStream.end === 'function') {
                this.logStream.end()
            }
        } catch (error) {
            console.error('Error durante cleanup:', error)
        }
    }

    public async releaseSessionFiles() {
        const NAME_DIR_SESSION = `${this.globalVendorArgs.name}_sessions`
        const idTimer = await releaseTmp(NAME_DIR_SESSION, 0)
        clearInterval(idTimer)
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
        try {
            const botName = req[this.idBotName]
            const qrPath = join(process.cwd(), `${botName}.qr.png`)
            const fileStream = createReadStream(qrPath)
            res.writeHead(200, { 'Content-Type': 'image/png' })
            fileStream.pipe(res)
        } catch (e) {
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
    }

    protected getMessage = async (key: { remoteJid: string; id: string }) => {
        // only if store is present
        return proto.Message.create({})
    }

    protected saveCredsGlobal: (() => Promise<void>) | null = null

    /**
     * Iniciar todo Sherpa
     */
    protected initVendor = async () => {
        const NAME_DIR_SESSION = `${this.globalVendorArgs.name}_sessions`
        const { state, saveCreds } = await useMultiFileAuthState(NAME_DIR_SESSION)
        const loggerSherpa = pino({ level: 'fatal' }) as unknown as WALogger

        this.saveCredsGlobal = saveCreds

        try {
            if (this.globalVendorArgs.useBaileysStore) {
                if (this.globalVendorArgs.timeRelease > 0) {
                    // Clear previous releaseTmp interval to prevent accumulation on reconnects
                    if (this.releaseTmpTimer) {
                        clearInterval(this.releaseTmpTimer)
                        this.releaseTmpTimer = undefined
                    }
                    this.releaseTmpTimer = await releaseTmp(NAME_DIR_SESSION, this.globalVendorArgs.timeRelease)
                }
            }
        } catch (e) {
            this.logger.log(`[${new Date().toISOString()}] releaseTmp error, continuing without cleanup:`, e)
        }

        try {
            // Close previous socket to prevent leaked connections and event listeners
            if (this.vendor) {
                try {
                    this.vendor.ev?.removeAllListeners()
                    this.vendor.ws?.close()
                    this.vendor.end(undefined)
                } catch (e) {
                    this.logger.log(`[${new Date().toISOString()}] Error closing previous socket:`, e)
                }
                this.vendor = undefined
            }

            const waVersion = this.globalVendorArgs.version ?? [2, 3000, 1023223821]

            const sock = makeWASocketOther({
                logger: loggerSherpa,
                version: waVersion as WAVersion,
                printQRInTerminal: false,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, loggerSherpa),
                },
                browser: this.globalVendorArgs.browser as WABrowserDescription,
                syncFullHistory: false,
                markOnlineOnConnect: false,
                generateHighQualityLinkPreview: true,
                getMessage: this.getMessage,
                msgRetryCounterMap: {},
                userDevicesCache: this.userDevicesCache as any,
                retryRequestDelayMs: 2000, // Delay entre reintentos (2s para evitar rate-limit)
                connectTimeoutMs: 60_000, // 1 minuto timeout conexión
                keepAliveIntervalMs: 15_000, // Keep alive cada 15 segundos (recomendado por comunidad)
                qrTimeout: 40_000, // 40 segundos para QR
                defaultQueryTimeoutMs: 60_000, // 1 minuto para queries
                emitOwnEvents: false, // No emitir eventos propios
                patchMessageBeforeSending: async (msg) => {
                    // Upload pre-keys proactively to prevent decryption failures
                    try {
                        if (sock?.uploadPreKeysToServerIfRequired) {
                            await sock.uploadPreKeysToServerIfRequired()
                        }
                    } catch (e) {
                        this.logger.log(`[${new Date().toISOString()}] Pre-key upload error:`, e)
                    }
                    return msg
                },
                shouldIgnoreJid: (jid: string) => {
                    if (this.globalVendorArgs.groupsIgnore) {
                        return isJidGroup(jid) || isJidBroadcast(jid)
                    }
                    return false
                },
                ...this.globalVendorArgs,
            })

            this.vendor = sock
            if (this.globalVendorArgs.usePairingCode && !sock.authState.creds.registered) {
                if (this.globalVendorArgs.phoneNumber) {
                    const phoneNumberClean = utils.removePlus(this.globalVendorArgs.phoneNumber)
                    await utils.delay(2000)
                    const code = await this.vendor.requestPairingCode(phoneNumberClean)
                    this.emit('require_action', {
                        title: '⚡⚡ ACTION REQUIRED ⚡⚡',
                        instructions: [
                            `Accept the WhatsApp notification from ${this.globalVendorArgs.phoneNumber} on your phone 👌`,
                            `The pairing code is: ${code}`,
                            `Need help: https://link.codigoencasa.com/DISCORD`,
                        ],
                        payload: { qr: null, code: code },
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

            sock.ev.on('connection.update', async (update: { connection: any; lastDisconnect: any; qr: any }) => {
                const { connection, lastDisconnect, qr } = update

                this.logger.log(`[${new Date().toISOString()}] Connection update: ${connection}`)

                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
                const reason = lastDisconnect?.error?.message

                /** Connection closed for various reasons */
                if (connection === 'close') {
                    this.stopHealthCheck()
                    this.logger.log(
                        `[${new Date().toISOString()}] Connection closed. Status: ${statusCode}, Reason: ${reason}`
                    )

                    // Check if device was removed
                    const errorData = lastDisconnect?.error?.data
                    const isDeviceRemoved = errorData?.content?.some(
                        (item: any) => item?.attrs?.type === 'device_removed'
                    )

                    if (isDeviceRemoved) {
                        console.log(
                            `[${new Date().toISOString()}] ⚠️ Device removed - Session was deleted from WhatsApp`
                        )
                        this.logger.log(`[${new Date().toISOString()}] Device removed detected, clearing session...`)
                        const PATH_BASE = join(process.cwd(), `${this.globalVendorArgs.name}_sessions`)
                        await emptyDirSessions(PATH_BASE)
                        this.reconnectAttempts = 0
                        this.emit('auth_failure', [
                            `Something unexpected has occurred, do not panic`,
                            `Restart the BOT`,
                            `You can also check a log that has been created sherpa.log`,
                            `Need help: https://link.codigoencasa.com/DISCORD`,
                        ])
                        return
                    }

                    // Casos donde NO debemos reconectar
                    if (statusCode === DisconnectReason.loggedOut) {
                        this.logger.log(`[${new Date().toISOString()}] Logged out, clearing session and restarting...`)
                        const PATH_BASE = join(process.cwd(), `${this.globalVendorArgs.name}_sessions`)
                        await emptyDirSessions(PATH_BASE)
                        this.reconnectAttempts = 0
                        await this.delayedReconnect()
                        return
                    }

                    // badSession: try reconnecting first, but if it repeats too many times, clear session
                    if (statusCode === DisconnectReason.badSession) {
                        this.badSessionCount++
                        if (this.badSessionCount >= 3) {
                            this.logger.log(
                                `[${new Date().toISOString()}] Bad session repeated ${this.badSessionCount} times, clearing session...`
                            )
                            const PATH_BASE = join(process.cwd(), `${this.globalVendorArgs.name}_sessions`)
                            await emptyDirSessions(PATH_BASE)
                            this.badSessionCount = 0
                            this.reconnectAttempts = 0
                        }
                        await this.delayedReconnect()
                        return
                    }

                    // Casos donde debemos reconectar con backoff
                    if (this.shouldReconnect(statusCode)) {
                        await this.delayedReconnect()
                        return
                    }

                    // If statusCode is undefined/unknown, attempt reconnect rather than dying
                    if (statusCode === undefined || statusCode === null) {
                        this.logger.log(
                            `[${new Date().toISOString()}] Unknown disconnect (no status code), attempting reconnect...`
                        )
                        await this.delayedReconnect()
                        return
                    }

                    // Casos críticos - emitir error
                    this.logger.log(`[${new Date().toISOString()}] Critical error, stopping reconnection attempts`)
                    this.emit('auth_failure', [
                        `Critical connection error: ${reason}`,
                        `Status code: ${statusCode}`,
                        `Check sherpa.log for details`,
                        `Need help: https://link.codigoencasa.com/DISCORD`,
                    ])
                }

                /** Connection opened successfully */
                if (connection === 'open') {
                    this.logger.log(`[${new Date().toISOString()}] Connection opened successfully`)
                    this.reconnectAttempts = 0 // Reset counter on successful connection
                    this.reconnectDelay = 1000 // Reset delay
                    this.badSessionCount = 0 // Reset bad session counter
                    this.startHealthCheck()

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
                        ],
                        payload: { qr },
                    })
                    await baileyGenerateImage(qr, `${this.globalVendorArgs.name}.qr.png`)
                }
            })

            sock.ev.on('creds.update', async () => {
                await saveCreds()
            })

            return sock.ev
        } catch (e) {
            this.logger.log(e)
            this.emit('auth_failure', [
                `Something unexpected has occurred, do not panic`,
                `Restart the BOT`,
                `You can also check a log that has been created sherpa.log`,
                `Need help: https://link.codigoencasa.com/DISCORD`,
            ])
        }
    }

    /**
     * Extrae el número de teléfono (from) de un mensaje
     * @param messageCtx - Contexto del mensaje
     * @returns El número de teléfono extraído
     */
    private extractFromFromMessage(messageCtx: WAMessage): string | undefined {
        const remoteJid = (messageCtx?.key as any)?.remoteJid
        const remoteJidAlt = (messageCtx?.key as any)?.remoteJidAlt
        // Si remoteJid contiene @lid, usar remoteJidAlt si existe, sino extraer el número de remoteJid
        const fromParse = remoteJid?.includes('@lid') ? remoteJidAlt || remoteJid?.split('@')[0] : remoteJid
        return fromParse
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
                            if (sherpaIsValidNumber(messageCtx?.key?.remoteJid)) {
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
                                    const messageId = await this.vendor.requestPlaceholderResend([
                                        { messageKey: messageCtx.key },
                                    ])
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

                    // Extraer el número de teléfono del mensaje
                    const from = this.extractFromFromMessage(messageCtx)

                    let payload = {
                        ...messageCtx,
                        body: textToBody,
                        name: messageCtx?.pushName,
                        from: baileyCleanNumber(from),
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

                    if (payload.from === 'status@broadcast') continue
                    payload.from = sherpaCleanNumber(payload.from, true)

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

                    if (!sherpaIsValidNumber(payload.from)) {
                        continue
                    }

                    const btnCtx = payload?.message?.buttonsResponseMessage?.selectedDisplayText
                    if (btnCtx) payload.body = btnCtx

                    const listRowId = payload?.message?.listResponseMessage?.title
                    if (listRowId) payload.body = listRowId

                    const processDuplicate = () => {
                        if (messageCtx?.key?.id) {
                            const idWs = `${messageCtx.key.id}__${payload.from}`
                            const isDuplicate = this.idsDuplicates.includes(idWs)
                            if (isDuplicate) {
                                this.idsDuplicates = []
                                return false
                            }
                            if (this.idsDuplicates.length > 10) {
                                this.idsDuplicates = []
                            }
                            this.idsDuplicates.push(idWs)
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
     * @param {string} orderId
     * @param {string} orderToken
     * @example await getOrderDetails('order-id', 'order-token')
     */
    getOrderDetails = async (orderId: string, orderToken: string) => {
        const orderDetails = await this.vendor.getOrderDetails(orderId, orderToken)
        return orderDetails
    }

    /**
     * @deprecated sendPoll is not available in whaileys provider
     * @param {string} number
     * @param {string} text
     * @param {object} poll
     * @returns {Promise<false>}
     */
    sendPoll = async (
        numberIn: string,
        text: string,
        poll: { options: string[]; multiselect: any }
    ): Promise<false> => {
        this.emit('notice', {
            title: 'METHOD NOT AVAILABLE',
            instructions: [
                `sendPoll is not available with whaileys provider`,
                `This feature is only available with baileys provider`,
            ],
        })
        console.log(`[SherpaProvider] ⚠️ sendPoll method is not available in whaileys. Use baileys provider instead.`)
        return false
    }

    /**
     * Obtener LID (Local Identifier) para un número de teléfono (PN)
     * @param {string} phoneNumber - Número de teléfono en formato JID (e.g., '1234567890@s.whatsapp.net')
     * @returns {Promise<string|null>} - El LID correspondiente o null si no se encuentra
     * @example await getLIDForPN('1234567890@s.whatsapp.net')
     */
    getLIDForPN = async (phoneNumber: string) => {
        try {
            const vendor = this.vendor as any
            if (vendor?.signalRepository?.lidMapping?.getLIDForPN) {
                return await vendor.signalRepository.lidMapping.getLIDForPN(phoneNumber)
            }
            return null
        } catch (e) {
            this.logger.log(`[${new Date().toISOString()}] Error getting LID for PN:`, e)
            return null
        }
    }

    /**
     * Obtener número de teléfono (PN) para un LID (Local Identifier)
     * @param {string} lid - Local Identifier
     * @returns {Promise<string|null>} - El número de teléfono correspondiente o null si no se encuentra
     * @example await getPNForLID('lid:xxxxxx')
     */
    getPNForLID = async (lid: string) => {
        try {
            const vendor = this.vendor as any
            if (vendor?.signalRepository?.lidMapping?.getPNForLID) {
                return await vendor.signalRepository.lidMapping.getPNForLID(lid)
            }
            return null
        } catch (e) {
            this.logger.log(`[${new Date().toISOString()}] Error getting PN for LID:`, e)
            return null
        }
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
        return this.vendor.sendMessage(number, payload)
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
        return this.vendor.sendMessage(number, payload)
    }

    /**
     * Enviar audio
     * @alpha
     * @param {string} number
     * @param {string} message
     * @param {boolean} voiceNote optional
     * @example await sendMessage('+XXXXXXXXXXX', 'audio.mp3')
     */

    sendAudio = async (number: string, audioUrl: string) => {
        const payload: AnyMediaMessageContent = {
            audio: { url: audioUrl },
            ptt: true,
        }
        return this.vendor.sendMessage(number, payload)
    }

    /**
     *
     * @param {string} number
     * @param {string} message
     * @returns
     */
    sendText = async (number: string, message: string) => {
        const payload: AnyMessageContent = { text: message }
        return this.vendor.sendMessage(number, payload)
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

        return this.vendor.sendMessage(number, payload)
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

        return this.vendor.sendMessage(numberClean, buttonMessage)
    }

    /**
     * TODO: Necesita terminar de implementar el sendMedia y sendButton guiarse:
     * https://github.com/leifermendez/bot-whatsapp/blob/4e0fcbd8347f8a430adb43351b5415098a5d10df/packages/provider/src/web-whatsapp/index.js#L165
     * @param {string} number
     * @param {string} message
     * @example await sendMessage('+XXXXXXXXXXX', 'Hello World')
     */

    sendMessage = async (numberIn: string, message: string, options?: SendOptions): Promise<any> => {
        options = { ...options, ...options['options'] }
        const number = sherpaCleanNumber(`${numberIn}`)
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
            remoteJid,
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
            remoteJid,
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
        await this.vendor.sendPresenceUpdate(WAPresence, remoteJid)
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

        await this.vendor.sendMessage(remoteJid, buffer, { quoted: messages })
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
        const buffer = await downloadMediaMessage(ctx as WAMessage, 'buffer', {})
        const fileName = this.generateFileName(extension)

        const pathFile = join(options?.path ?? tmpdir(), fileName)
        await writeFile(pathFile, buffer)
        return resolve(pathFile)
    }

    /**
     * Starts a periodic health check that verifies the WebSocket connection is alive.
     * If the connection is detected as dead (zombie), it triggers a reconnect.
     * Also sends periodic presence updates as an application-level heartbeat
     * to prevent WhatsApp from considering the connection inactive.
     */
    private startHealthCheck() {
        this.stopHealthCheck()

        // WebSocket state check every 30 seconds
        this.healthCheckInterval = setInterval(() => {
            try {
                const sock = this.vendor
                if (!sock) return

                const wsState = sock?.ws?.readyState
                // WebSocket.OPEN = 1, if it's not open and not connecting, connection is dead
                if (wsState !== undefined && wsState !== 1 && wsState !== 0) {
                    this.logger.log(
                        `[${new Date().toISOString()}] Health check: WebSocket dead (state=${wsState}), triggering reconnect...`
                    )
                    this.stopHealthCheck()
                    this.delayedReconnect()
                }
            } catch (error) {
                this.logger.log(`[${new Date().toISOString()}] Health check error:`, error)
            }
        }, 30_000) // Check every 30 seconds

        // Presence update with random interval (3-8 min) to mimic human behavior
        const schedulePresenceHeartbeat = () => {
            // Guard: don't schedule if health check was stopped (prevents orphaned timers)
            if (!this.healthCheckInterval) return

            const minDelay = 180_000 // 3 minutes
            const maxDelay = 480_000 // 8 minutes
            const randomDelay = minDelay + Math.floor(Math.random() * (maxDelay - minDelay))

            this.presenceInterval = setTimeout(async () => {
                try {
                    const sock = this.vendor
                    if (!sock) return
                    await sock.sendPresenceUpdate('available')
                    this.logger.log(
                        `[${new Date().toISOString()}] Presence heartbeat sent (next in ~${Math.round(randomDelay / 60_000)}min)`
                    )
                } catch (error) {
                    this.logger.log(`[${new Date().toISOString()}] Presence heartbeat error:`, error)
                }
                // Schedule the next one with a new random delay
                schedulePresenceHeartbeat()
            }, randomDelay)
        }
        schedulePresenceHeartbeat()
    }

    private stopHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval)
            this.healthCheckInterval = undefined
        }
        if (this.presenceInterval) {
            clearTimeout(this.presenceInterval)
            this.presenceInterval = undefined
        }
    }

    private shouldReconnect(statusCode: number): boolean {
        // Lista de códigos donde SÍ debemos reconectar
        const reconnectableCodes = [
            DisconnectReason.connectionClosed,
            DisconnectReason.connectionLost,
            DisconnectReason.connectionReplaced,
            DisconnectReason.timedOut,
            DisconnectReason.badSession,
            DisconnectReason.restartRequired,
            429, // Rate limited
            500, // Server error
            502, // Bad gateway
            503, // Service unavailable
            504, // Gateway timeout
        ]

        return reconnectableCodes.includes(statusCode) && this.reconnectAttempts < this.maxReconnectAttempts
    }

    private async delayedReconnect(): Promise<void> {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.log(
                `[${new Date().toISOString()}] Max reconnection attempts reached (${this.maxReconnectAttempts})`
            )
            this.emit('auth_failure', [
                `Maximum reconnection attempts reached`,
                `Please check your internet connection`,
                `Check baileys.log for details`,
                `Need help: https://link.codigoencasa.com/DISCORD`,
            ])
            return
        }

        this.reconnectAttempts++
        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000) // Max 30 segundos

        this.logger.log(
            `[${new Date().toISOString()}] Reconnection attempt ${this.reconnectAttempts}/${
                this.maxReconnectAttempts
            } in ${delay}ms`
        )

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = undefined
            this.initVendor()
                .then((v) => this.listenOnEvents(v))
                .catch((error) => {
                    this.logger.log(`[${new Date().toISOString()}] Reconnection failed:`, error)
                    if (this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.delayedReconnect()
                    }
                })
        }, delay)
    }
}

export { SherpaProvider }
