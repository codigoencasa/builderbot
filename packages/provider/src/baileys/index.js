const { ProviderClass } = require('@bot-whatsapp/bot')
const { Sticker } = require('wa-sticker-formatter')
const pino = require('pino')
const rimraf = require('rimraf')
const mime = require('mime-types')
const { join } = require('path')
const { createWriteStream, readFileSync } = require('fs')
const { Console } = require('console')

const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require('@adiwajshing/baileys')

const { baileyGenerateImage, baileyCleanNumber, baileyIsValidNumber } = require('./utils')

const { generalDownload } = require('../../common/download')

const logger = new Console({
    stdout: createWriteStream(`${process.cwd()}/baileys.log`),
})

/**
 * ⚙️ BaileysProvider: Es una clase tipo adaptor
 * que extiende clases de ProviderClass (la cual es como interfaz para sber que funciones rqueridas)
 * https://github.com/adiwajshing/Baileys
 */
class BaileysProvider extends ProviderClass {
    globalVendorArgs = { name: `bot` }
    vendor
    saveCredsGlobal = null
    constructor(args) {
        super()
        this.globalVendorArgs = { ...this.globalVendorArgs, ...args }
        this.initBailey().then()
    }

    /**
     * Iniciar todo Bailey
     */
    initBailey = async () => {
        const NAME_DIR_SESSION = `${this.globalVendorArgs.name}_sessions`
        const { state, saveCreds } = await useMultiFileAuthState(NAME_DIR_SESSION)
        this.saveCredsGlobal = saveCreds

        try {
            const sock = makeWASocket({
                printQRInTerminal: false,
                auth: state,
                browser: Browsers.macOS('Desktop'),
                syncFullHistory: false,
                logger: pino({ level: 'fatal' }),
            })

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update

                const statusCode = lastDisconnect?.error?.output?.statusCode

                /** Conexion cerrada por diferentes motivos */
                if (connection === 'close') {
                    if (statusCode !== DisconnectReason.loggedOut) {
                        this.initBailey()
                    }

                    if (statusCode === DisconnectReason.loggedOut) {
                        const PATH_BASE = join(process.cwd(), NAME_DIR_SESSION)
                        rimraf(PATH_BASE, (err) => {
                            if (err) return
                        })

                        this.initBailey()
                    }
                }

                /** Conexion abierta correctamente */
                if (connection === 'open') {
                    this.emit('ready', true)
                    this.initBusEvents(sock)
                }

                /** QR Code */
                if (qr) {
                    this.emit('require_action', {
                        instructions: [
                            `Debes escanear el QR Code para iniciar ${this.globalVendorArgs.name}.qr.png`,
                            `Recuerda que el QR se actualiza cada minuto `,
                            `Necesitas ayuda: https://link.codigoencasa.com/DISCORD`,
                        ],
                    })
                    await baileyGenerateImage(qr, `${this.globalVendorArgs.name}.qr.png`)
                }
            })

            sock.ev.on('creds.update', async () => {
                await saveCreds()
            })
        } catch (e) {
            logger.log(e)
            this.emit('auth_failure', [
                `Algo inesperado ha ocurrido NO entres en pánico`,
                `Reinicia el BOT`,
                `Tambien puedes mirar un log que se ha creado baileys.log`,
                `Necesitas ayuda: https://link.codigoencasa.com/DISCORD`,
                `(Puedes abrir un ISSUE) https://github.com/codigoencasa/bot-whatsapp/issues/new/choose`,
            ])
        }
    }

    /**
     * Mapeamos los eventos nativos a los que la clase Provider espera
     * para tener un standar de eventos
     * @returns
     */
    busEvents = () => [
        {
            event: 'messages.upsert',
            func: ({ messages, type }) => {
                if (type !== 'notify') return
                const [messageCtx] = messages
                let payload = {
                    ...messageCtx,
                    body: messageCtx?.message?.extendedTextMessage?.text ?? messageCtx?.message?.conversation,
                    from: messageCtx?.key?.remoteJid,
                }

                if (payload.from === 'status@broadcast') return

                if (payload?.key?.fromMe) return

                if (!baileyIsValidNumber(payload.from)) {
                    return
                }

                const btnCtx = payload?.message?.buttonsResponseMessage?.selectedDisplayText

                if (btnCtx) payload.body = btnCtx

                payload.from = baileyCleanNumber(payload.from, true)
                this.emit('message', payload)
            },
        },
    ]

    initBusEvents = (_sock) => {
        this.vendor = _sock
        const listEvents = this.busEvents()

        for (const { event, func } of listEvents) {
            this.vendor.ev.on(event, func)
        }
    }

    /**
     * @alpha
     * @param {string} number
     * @param {string} message
     * @example await sendMessage('+XXXXXXXXXXX', 'https://dominio.com/imagen.jpg' | 'img/imagen.jpg')
     */

    sendMedia = async (number, imageUrl, text) => {
        const fileDownloaded = await generalDownload(imageUrl)
        const mimeType = mime.lookup(fileDownloaded)

        if (mimeType.includes('image')) return this.sendImage(number, fileDownloaded, text)
        if (mimeType.includes('video')) return this.sendVideo(number, fileDownloaded, text)
        if (mimeType.includes('audio')) return this.sendAudio(number, fileDownloaded, text)

        return this.sendFile(number, fileDownloaded)
    }

    /**
     * Enviar imagen
     * @param {*} number
     * @param {*} imageUrl
     * @param {*} text
     * @returns
     */
    sendImage = async (number, filePath, text) => {
        return this.vendor.sendMessage(number, {
            image: readFileSync(filePath),
            caption: text,
        })
    }

    /**
     * Enviar video
     * @param {*} number
     * @param {*} imageUrl
     * @param {*} text
     * @returns
     */
    sendVideo = async (number, filePath, text) => {
        return this.vendor.sendMessage(number, {
            video: readFileSync(filePath),
            caption: text,
            gifPlayback: true,
        })
    }

    /**
     * Enviar audio
     * @alpha
     * @param {string} number
     * @param {string} message
     * @param {boolean} voiceNote optional
     * @example await sendMessage('+XXXXXXXXXXX', 'audio.mp3')
     */

    sendAudio = async (number, audioUrl, voiceNote = false) => {
        return this.vendor.sendMessage(number, {
            audio: { url: audioUrl },
            ptt: voiceNote,
        })
    }

    /**
     *
     * @param {string} number
     * @param {string} message
     * @returns
     */
    sendText = async (number, message) => {
        return this.vendor.sendMessage(number, { text: message })
    }

    /**
     *
     * @param {string} number
     * @param {string} filePath
     * @example await sendMessage('+XXXXXXXXXXX', './document/file.pdf')
     */

    sendFile = async (number, filePath) => {
        const mimeType = mime.lookup(filePath)
        const fileName = filePath.split('/').pop()
        return this.vendor.sendMessage(number, {
            document: { url: filePath },
            mimetype: mimeType,
            fileName: fileName,
        })
    }

    /**
     *
     * @param {string} number
     * @param {string} text
     * @param {string} footer
     * @param {Array} buttons
     * @example await sendMessage("+XXXXXXXXXXX", "Your Text", "Your Footer", [{"buttonId": "id", "buttonText": {"displayText": "Button"}, "type": 1}])
     */

    sendButtons = async (number, text, buttons) => {
        const numberClean = baileyCleanNumber(number)

        const templateButtons = buttons.map((btn, i) => ({
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
    sendMessage = async (numberIn, message, { options }) => {
        const number = baileyCleanNumber(numberIn)

        if (options?.buttons?.length) return this.sendButtons(number, message, options.buttons)
        if (options?.media) return this.sendMedia(number, options.media, message)
        return this.sendText(number, message)
    }

    /**
     * @param {string} remoteJid
     * @param {string} latitude
     * @param {string} longitude
     * @param {any} messages
     * @example await sendLocation("xxxxxxxxxxx@c.us" || "xxxxxxxxxxxxxxxxxx@g.us", "xx.xxxx", "xx.xxxx", messages)
     */

    sendLocation = async (remoteJid, latitude, longitude, messages = null) => {
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
     * @param {any} messages - optional
     * @example await sendContact("xxxxxxxxxxx@c.us" || "xxxxxxxxxxxxxxxxxx@g.us", "+xxxxxxxxxxx", "Robin Smith", messages)
     */

    sendContact = async (remoteJid, contactNumber, displayName, messages = null) => {
        const cleanContactNumber = contactNumber.replaceAll(' ', '')
        const waid = cleanContactNumber.replace('+', '')

        const vcard =
            'BEGIN:VCARD\n' +
            'VERSION:3.0\n' +
            `FN:${displayName}\n` +
            'ORG:Ashoka Uni;\n' +
            `TEL;type=CELL;type=VOICE;waid=${waid}:${cleanContactNumber}\n` +
            'END:VCARD'

        await this.client.sendMessage(
            remoteJid,
            {
                contacts: {
                    displayName: 'XD',
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
    sendPresenceUpdate = async (remoteJid, WAPresence) => {
        await this.client.sendPresenceUpdate(WAPresence, remoteJid)
    }

    /**
     * @param {string} remoteJid
     * @param {string} url
     * @param {object} stickerOptions
     * @param {any} messages - optional
     * @example await sendSticker("xxxxxxxxxxx@c.us" || "xxxxxxxxxxxxxxxxxx@g.us", "https://dn/image.png" || "https://dn/image.gif" || "https://dn/image.mp4", {pack: 'User', author: 'Me'} messages)
     */

    sendSticker = async (remoteJid, url, stickerOptions, messages = null) => {
        const sticker = new Sticker(url, {
            ...stickerOptions,
            quality: 50,
            type: 'crop',
        })

        const buffer = await sticker.toMessage()

        await this.client.sendMessage(remoteJid, buffer, { quoted: messages })
    }
}

module.exports = BaileysProvider
