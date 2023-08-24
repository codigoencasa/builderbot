const { ProviderClass } = require('@bot-whatsapp/bot')
const { create, defaultLogger } = require('@wppconnect-team/wppconnect')
const { WppConnectGenerateImage, WppConnectValidNumber, WppConnectCleanNumber } = require('./utils')
const { generalDownload } = require('../../common/download')
const { generateRefprovider } = require('../../common/hash')
const { convertAudio } = require('../utils/convertAudio')
const mime = require('mime-types')

/**
 * ⚙️ WppConnectProvider: Es una clase tipo adaptador
 * que extiende la clase ProviderClass (la cual es como una interfaz para saber qué funciones son requeridas).
 * https://github.com/wppconnect-team/wppconnect
 */
defaultLogger.transports.forEach((t) => (t.silent = true)) //<==
class WPPConnectProviderClass extends ProviderClass {
    globalVendorArgs = { name: 'bot' }
    vendor

    constructor(args) {
        super()
        this.globalVendorArgs = { ...this.globalVendorArgs, ...args }
        this.initWppConnect().then()
    }

    /**
     * Iniciar WppConnect
     */
    initWppConnect = async () => {
        try {
            this.emit('preinit')
            const name = this.globalVendorArgs.name
            const session = await create({
                session: name,
                catchQR: (base64Qrimg, { attempt }) => {
                    if (attempt == 5) throw new Error()

                    this.emit('require_action', {
                        instructions: [
                            `Debes escanear el QR Code para iniciar ${this.globalVendorArgs.name}.qr.png`,
                            `Recuerde que el código QR se actualiza cada minuto `,
                            `¿Necesita ayuda? https://link.codigoencasa.com/DISCORD`,
                        ],
                    })
                    WppConnectGenerateImage(base64Qrimg, `${this.globalVendorArgs.name}.qr.png`)
                },
                puppeteerOptions: {
                    headless: true,
                    args: ['--no-sandbox'],
                },
            })

            this.vendor = session
            this.emit('ready', true)
            this.initBusEvents()
        } catch (error) {
            this.emit('auth_failure', [
                `Algo inesperado ha ocurrido, no entres en pánico`,
                `Reinicie el bot`,
                `También puede consultar el registro generado wppconnect.log`,
                `Necesita ayuda: https://link.codigoencasa.com/DISCORD`,
                `(Puede abrir un ISSUE) https://github.com/codigoencasa/bot-whatsapp/issues/new/choose`,
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
            event: 'onMessage',
            func: (payload) => {
                if (payload.from === 'status@broadcast') {
                    return
                }
                if (!WppConnectValidNumber(payload.from)) {
                    return
                }
                payload.from = WppConnectCleanNumber(payload.from, false)

                if (payload.hasOwnProperty('type') && ['image', 'video'].includes(payload.type)) {
                    payload = { ...payload, body: generateRefprovider('_event_media_') }
                }
                if (payload.hasOwnProperty('type') && ['document'].includes(payload.type)) {
                    payload = { ...payload, body: generateRefprovider('_event_document_') }
                }
                if (payload.hasOwnProperty('type') && ['ptt'].includes(payload.type)) {
                    payload = { ...payload, body: generateRefprovider('_event_voice_note_') }
                }
                if (payload.hasOwnProperty('lat') && payload.hasOwnProperty('lng')) {
                    const lat = payload.lat
                    const lng = payload.lng
                    if (lat !== '' && lng !== '') {
                        payload = { ...payload, body: generateRefprovider('_event_location_') }
                    }
                }

                // Emitir el evento "message" con el payload modificado
                this.emit('message', payload)
            },
        },
        {
            event: 'onPollResponse',
            func: async (payload) => {
                const selectedOption = payload.selectedOptions.find((option) => option && option.name)

                payload.id = payload.msgId?._serialized ?? ''
                payload.type = 'poll'
                payload.body = selectedOption ? selectedOption.name : ''
                payload.notifyName = payload.sender
                payload.from = WppConnectCleanNumber(payload.sender, false)
                payload.to = payload.sender
                payload.sender = (await this.vendor.getContact(payload.chatId)) ?? {}
                payload.notifyName = payload?.sender?.pushname ?? ''
                payload.t = payload.timestamp

                // Emitir el evento "message" con el payload modificado
                this.emit('message', payload)
            },
        },
    ]

    initBusEvents = () => {
        const listEvents = this.busEvents()

        for (const { event, func } of listEvents) {
            if (this.vendor[event]) this.vendor[event]((payload) => func(payload))
        }
    }

    /**
     * Enviar mensaje con botones
     * @param {string} number
     * @param {string} text
     * @param {Array} buttons
     * @example await sendButtons("+XXXXXXXXXXX", "Your Text", [{"body": "Button 1"},{"body": "Button 2"}])
     */
    sendButtons = async (number, text, buttons) => {
        const templateButtons = buttons.map((btn, i) => ({
            id: `id-btn-${i}`,
            text: btn.body,
        }))

        const buttonMessage = {
            useTemplateButtons: true,
            buttons: templateButtons,
        }

        return this.vendor.sendText(number, text, buttonMessage)
    }

    /**
     * Enviar mensaje con encuesta
     * @param {string} number
     * @param {string} text
     * @param {Array} poll
     * @example await sendPollMessage("+XXXXXXXXXXX", "You accept terms", [ "Yes", "Not"], {"selectableCount": 1})
     */

    sendPoll = async (number, text, poll) => {
        if (poll.options.length < 2) return false

        const selectableCount = poll.multiselect === undefined ? 1 : poll.multiselect ? 1 : 0
        return this.vendor.sendPollMessage(number, text, poll.options, { selectableCount })
    }

    /**
     * Enviar audio
     * @alpha
     * @param {string} number
     * @param {string} message
     * @param {boolean} voiceNote optional
     * @example await sendMessage('+XXXXXXXXXXX', 'audio.mp3')
     */

    sendPtt = async (number, audioPath) => {
        return this.vendor.sendPtt(number, audioPath)
    }

    /**
     * Enviar imagen
     * @param {*} number
     * @param {*} imageUrl
     * @param {*} text
     * @returns
     */
    sendImage = async (number, filePath, text) => {
        return this.vendor.sendImage(number, filePath, 'image-name', text)
    }

    /**
     *
     * @param {string} number
     * @param {string} filePath
     * @example await sendMessage('+XXXXXXXXXXX', './document/file.pdf')
     */

    sendFile = async (number, filePath, text) => {
        const fileName = filePath.split('/').pop()
        return this.vendor.sendFile(number, filePath, fileName, text)
    }

    /**
     * Enviar video
     * @param {*} number
     * @param {*} imageUrl
     * @param {*} text
     * @returns
     */
    sendVideo = async (number, filePath, text) => {
        return this.vendor.sendVideoAsGif(number, filePath, 'video.gif', text)
    }

    /**
     * Enviar imagen o multimedia
     * @param {*} number
     * @param {*} mediaInput
     * @param {*} message
     * @returns
     */
    sendMedia = async (number, mediaUrl, text) => {
        const fileDownloaded = await generalDownload(mediaUrl)
        const mimeType = mime.lookup(fileDownloaded)

        if (mimeType.includes('image')) return this.sendImage(number, fileDownloaded, text)
        if (mimeType.includes('video')) return this.sendVideo(number, fileDownloaded, text)
        if (mimeType.includes('audio')) {
            const fileOpus = await convertAudio(fileDownloaded)
            return this.sendPtt(number, fileOpus)
        }

        return this.sendFile(number, fileDownloaded, text)
    }

    /**
     * Enviar mensaje al usuario
     * @param {*} to
     * @param {*} message
     * @param {*} param2
     * @returns
     */
    sendMessage = async (to, message, { options }) => {
        const number = to
        if (options?.buttons?.length) return this.sendButtons(number, message, options.buttons)
        if (options?.media) return this.sendMedia(number, options.media, message)
        return this.vendor.sendText(number, message)
    }
}

module.exports = WPPConnectProviderClass
