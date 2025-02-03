import { ProviderClass, utils } from '@builderbot/bot'
import type { BotContext, Button, SendOptions } from '@builderbot/bot/dist/types'
import type { Boom } from '@hapi/boom'
import { Console } from 'console'
import type { PathOrFileDescriptor } from 'fs'
import { createReadStream, createWriteStream, readFileSync, existsSync } from 'fs'
import { writeFile } from 'fs/promises'
import mime from 'mime-types'
import { tmpdir } from 'os'
import { join, basename, resolve } from 'path'
import pino from 'pino'
import type polka from 'polka'
import type { IStickerOptions } from 'wa-sticker-formatter'
import { Sticker } from 'wa-sticker-formatter'

import {
    AnyMediaMessageContent,
    AnyMessageContent,
    BaileysEventMap,
    PollMessageOptions,
    WAMessage,
    WASocket,
    MessageUpsertType,
    isJidGroup,
    isJidBroadcast,
    makeInMemoryStore,
    DisconnectReason,
    downloadMediaMessage,
    getAggregateVotesInPollMessage,
    makeCacheableSignalKeyStore,
    makeWASocketOther,
    proto,
    useMultiFileAuthState,
} from './baileyWrapper'
import bindStore from './bindStore'
import { releaseTmp } from './releaseTmp'
import type { BaileyGlobalVendorArgs } from './type'
import { baileyGenerateImage, baileyCleanNumber, baileyIsValidNumber, emptyDirSessions } from './utils'

const logger = new Console({
    stdout: createWriteStream(`${process.cwd()}/baileys.log`),
})

class BaileysProvider extends ProviderClass<WASocket> {
    public globalVendorArgs: BaileyGlobalVendorArgs = {
        name: `bot`,
        gifPlayback: false,
        usePairingCode: false,
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        phoneNumber: null,
        useBaileysStore: true,
        port: 3000,
        timeRelease: 0, //21600000
        writeMyself: 'none',
        groupsIgnore: false,
        readStatus: false,
        experimentalStore: false,
        autoRefresh: 0,
        experimentalSyncMessage: undefined,
    }

    store?: ReturnType<typeof makeInMemoryStore>

    private idsDuplicates = []
    private mapSet = new Set()

    constructor(args: Partial<BaileyGlobalVendorArgs>) {
        super()
        this.store = null
        this.globalVendorArgs = { ...this.globalVendorArgs, ...args }
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
        if (this.store) {
            const msg = await this.store.loadMessage(key.remoteJid, key.id)
            return msg?.message || undefined
        }
        // only if store is present
        return proto.Message.fromObject({})
    }

    protected saveCredsGlobal: (() => Promise<void>) | null = null

    /**
     * Iniciar todo Bailey
     */
    protected initVendor = async () => {
        const NAME_DIR_SESSION = `${this.globalVendorArgs.name}_sessions`
        const { state, saveCreds } = await useMultiFileAuthState(NAME_DIR_SESSION)
        const loggerBaileys = pino({ level: 'fatal' })

        this.saveCredsGlobal = saveCreds

        try {
            if (this.globalVendorArgs.useBaileysStore) {
                this.store = !this.globalVendorArgs.experimentalStore
                    ? makeInMemoryStore({ logger: loggerBaileys })
                    : bindStore({ logger: loggerBaileys })

                if (this.store?.readFromFile) this.store?.readFromFile(`${NAME_DIR_SESSION}/baileys_store.json`)

                if (this.globalVendorArgs.autoRefresh > 0) {
                    setInterval(() => {
                        if (this.globalVendorArgs.host?.phone) {
                            try {
                                const jid = this.globalVendorArgs.host?.id
                                this.vendor.presenceSubscribe(jid)
                                this.vendor.getBusinessProfile(jid)
                            } catch (e) {
                                console.log(e)
                            }
                        }
                    }, this.globalVendorArgs.autoRefresh)
                }

                setInterval(() => {
                    const path = `${NAME_DIR_SESSION}/baileys_store.json`
                    if (existsSync(NAME_DIR_SESSION)) {
                        this.store?.writeToFile(path)
                    }
                }, 10_000)

                if (this.globalVendorArgs.timeRelease > 0) {
                    await releaseTmp(NAME_DIR_SESSION, this.globalVendorArgs.timeRelease)
                }
            }
        } catch (e) {
            logger.log(e)
            this.initVendor().then((v) => this.listenOnEvents(v))
        }

        try {
            const sock = makeWASocketOther({
                logger: loggerBaileys,
                printQRInTerminal: false,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, loggerBaileys),
                },
                browser: this.globalVendorArgs.browser,
                syncFullHistory: false,
                markOnlineOnConnect: false,
                generateHighQualityLinkPreview: true,
                getMessage: async (key: { remoteJid: string; id: string }) =>
                    (await this.getMessage(key)) as Promise<proto.IMessage>,
                retryRequestDelayMs: 350,
                maxMsgRetryCount: 4,
                connectTimeoutMs: 20_000,
                keepAliveIntervalMs: 30_000,
                shouldIgnoreJid: (jid: string) => {
                    const isGroupJid = this.globalVendorArgs.groupsIgnore && isJidGroup(jid)
                    const isBroadcast = !this.globalVendorArgs.readStatus && isJidBroadcast(jid)
                    return isGroupJid || isBroadcast
                },
                patchMessageBeforeSending: (message: {
                    deviceSentMessage: { message: { listMessage: { listType: proto.Message.ListMessage.ListType } } }
                    listMessage: { listType: proto.Message.ListMessage.ListType }
                }) => {
                    if (
                        message.deviceSentMessage?.message?.listMessage?.listType ===
                        proto.Message.ListMessage.ListType.PRODUCT_LIST
                    ) {
                        message = JSON.parse(JSON.stringify(message))
                        message.deviceSentMessage.message.listMessage.listType =
                            proto.Message.ListMessage.ListType.SINGLE_SELECT
                    }
                    if (message.listMessage?.listType == proto.Message.ListMessage.ListType.PRODUCT_LIST) {
                        message = JSON.parse(JSON.stringify(message))
                        message.listMessage.listType = proto.Message.ListMessage.ListType.SINGLE_SELECT
                    }
                    return message
                },
                ...this.globalVendorArgs,
            })

            if (this?.store) this.store.bind(sock.ev)
            this.vendor = sock
            if (this.globalVendorArgs.usePairingCode && !sock.authState.creds.registered) {
                if (this.globalVendorArgs.phoneNumber) {
                    await sock.waitForConnectionUpdate((update: { qr: any }) => !!update.qr)
                    const phoneNumberClean = utils.removePlus(this.globalVendorArgs.phoneNumber)
                    const code = await sock.requestPairingCode(phoneNumberClean)

                    this.emit('require_action', {
                        title: '⚡⚡ ACTION REQUIRED ⚡⚡',
                        instructions: [
                            `Accept the WhatsApp notification from ${this.globalVendorArgs.phoneNumber} on your phone 👌`,
                            `The token for linking is: ${code}`,
                            `Need help: https://link.codigoencasa.com/DISCORD`,
                        ],
                        payload: { qr: null, code },
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

                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
                /** Connection closed for various reasons */
                if (connection === 'close') {
                    if (statusCode !== DisconnectReason.loggedOut) {
                        this.initVendor().then((v) => this.listenOnEvents(v))
                        return
                    }

                    if (statusCode === DisconnectReason.loggedOut) {
                        const PATH_BASE = join(process.cwd(), NAME_DIR_SESSION)
                        await emptyDirSessions(PATH_BASE)
                        this.initVendor().then((v) => this.listenOnEvents(v))
                        return
                    }
                }

                /** Connection opened successfully */
                if (connection === 'open') {
                    const parseNumber = `${sock?.user?.id}`.split(':').shift()
                    const host = { ...sock?.user, phone: parseNumber }
                    this.globalVendorArgs.host = host
                    this.emit('ready', true)
                    this.emit('host', host)
                }

                /** QR Code */
                if (qr && !this.globalVendorArgs.usePairingCode) {
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
            logger.log(e)
            this.emit('auth_failure', [
                `Something unexpected has occurred, do not panic`,
                `Restart the BOT`,
                `You can also check a log that has been created baileys.log`,
                `Need help: https://link.codigoencasa.com/DISCORD`,
            ])
        }
    }

    /**
     * Map native events that the Provider class expects
     * to have a standard set of events
     * @returns
     */
    protected busEvents = (): { event: keyof BaileysEventMap; func: (arg?: any, arg2?: any) => any }[] => [
        {
            event: 'messages.upsert',
            func: async (argFromProvider) => {
                const { messages, type } = argFromProvider as { type: MessageUpsertType; messages: WAMessage[] }
                if (type !== 'notify') return

                const pingMessageSync = async (_messageCtx: proto.IWebMessageInfo) => {
                    if (!this.mapSet.has(_messageCtx?.key?.remoteJid)) {
                        try {
                            this.mapSet.add(_messageCtx?.key?.remoteJid)
                            const jid = _messageCtx?.key?.remoteJid

                            await this.vendor.readMessages([_messageCtx?.key])
                            await this.vendor.sendMessage(jid, { text: this.globalVendorArgs.experimentalSyncMessage })
                        } catch (e) {
                            logger.log(e)
                        }
                    }
                }

                const [messageCtx] = messages

                if (messageCtx?.messageStubParameters?.length && messageCtx.messageStubParameters[0].includes('absent'))
                    return
                if (
                    messageCtx?.messageStubParameters?.length &&
                    messageCtx.messageStubParameters[0].includes('No session')
                )
                    return
                if (
                    messageCtx?.messageStubParameters?.length &&
                    messageCtx.messageStubParameters[0].includes('Bad MAC')
                )
                    return
                if (
                    messageCtx?.messageStubParameters?.length &&
                    messageCtx.messageStubParameters[0].includes('Invalid')
                ) {
                    if (
                        this.globalVendorArgs.experimentalSyncMessage &&
                        this.globalVendorArgs.experimentalSyncMessage.length
                    ) {
                        if (baileyIsValidNumber(messageCtx?.key?.remoteJid)) {
                            await pingMessageSync(messageCtx)
                        }
                    }
                    return
                }
                // if (((messageCtx?.message?.protocolMessage?.type) as unknown as string) === 'EPHEMERAL_SETTING') return

                const textToBody =
                    messageCtx?.message?.ephemeralMessage?.message?.extendedTextMessage?.text ??
                    messageCtx?.message?.extendedTextMessage?.text ??
                    messageCtx?.message?.conversation

                // if (idWs) this.idsDuplicates.push(idWs)

                let payload = {
                    ...messageCtx,
                    body: textToBody,
                    name: messageCtx?.pushName,
                    from: messageCtx?.key?.remoteJid,
                }

                //Detectar location
                if (messageCtx.message?.locationMessage) {
                    const { degreesLatitude, degreesLongitude } = messageCtx.message.locationMessage
                    if (typeof degreesLatitude === 'number' && typeof degreesLongitude === 'number') {
                        payload = {
                            ...payload,
                            body: utils.generateRefProvider('_event_location_'),
                        }
                    }
                }

                //Detectar video
                if (messageCtx.message?.videoMessage) {
                    payload = { ...payload, body: utils.generateRefProvider('_event_media_') }
                }

                //Detectar Sticker
                if (messageCtx.message?.stickerMessage) {
                    payload = { ...payload, body: utils.generateRefProvider('_event_media_') }
                }

                //Detectar media
                if (messageCtx.message?.imageMessage) {
                    payload = { ...payload, body: utils.generateRefProvider('_event_media_') }
                }

                //Detectar file
                if (messageCtx.message?.documentMessage || messageCtx.message?.documentWithCaptionMessage) {
                    payload = { ...payload, body: utils.generateRefProvider('_event_document_') }
                }

                //Detectar voice note
                if (messageCtx.message?.audioMessage) {
                    payload = { ...payload, body: utils.generateRefProvider('_event_voice_note_') }
                }

                //Detectar order message
                if (messageCtx.message?.orderMessage) {
                    payload = { ...payload, body: utils.generateRefProvider('_event_order_') }
                }

                if (payload.from === 'status@broadcast') return
                payload.from = baileyCleanNumber(payload.from, true)

                if (this.globalVendorArgs.writeMyself === 'none' && payload?.key?.fromMe) return
                if (
                    this.globalVendorArgs.host?.phone !== payload.from &&
                    payload?.key?.fromMe &&
                    !['both'].includes(this.globalVendorArgs.writeMyself)
                )
                    return
                if (
                    this.globalVendorArgs.host?.phone === payload.from &&
                    !['both', 'host'].includes(this.globalVendorArgs.writeMyself)
                )
                    return

                if (!baileyIsValidNumber(payload.from)) {
                    return
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

                            const messageOriginalKey = messageCtx?.update?.pollUpdates[0]?.pollUpdateMessageKey
                            const messageOriginal = await this.store?.loadMessage(
                                messageOriginalKey.remoteJid,
                                messageOriginalKey.id
                            )

                            const payload = {
                                ...messageCtx,
                                body: pollMessage.find((poll) => poll.voters.length > 0)?.name || '',
                                from: baileyCleanNumber(key.remoteJid, true),
                                pushName: messageOriginal?.pushName,
                                broadcast: messageOriginal?.broadcast,
                                messageTimestamp: messageOriginal?.messageTimestamp,
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
     * TODO: Necesita terminar de implementar el sendMedia y sendButton guiarse:
     * https://github.com/leifermendez/bot-whatsapp/blob/4e0fcbd8347f8a430adb43351b5415098a5d10df/packages/provider/src/web-whatsapp/index.js#L165
     * @param {string} number
     * @param {string} message
     * @example await sendMessage('+XXXXXXXXXXX', 'Hello World')
     */

    sendMessage = async (numberIn: string, message: string, options?: SendOptions): Promise<any> => {
        options = { ...options, ...options['options'] }
        const number = baileyCleanNumber(`${numberIn}`)
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
}

export { BaileysProvider }
