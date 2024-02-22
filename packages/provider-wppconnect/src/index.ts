import { ProviderClass, utils } from '@bot-whatsapp/bot'
import { BotContext, SendOptions } from '@bot-whatsapp/bot/dist/types'
import { Message, Whatsapp, create, defaultLogger } from '@wppconnect-team/wppconnect'
import { writeFile } from 'fs/promises'
import mime from 'mime-types'
import { tmpdir } from 'os'
import { join } from 'path'

import { WPPConnectHttpServer } from './server'
import { BotCtxMiddleware, SaveFileOptions } from './types'
import { WppConnectGenerateImage, WppConnectValidNumber, WppConnectCleanNumber } from './utils'

/**
 * ⚙️ WppConnectProvider: Es una clase tipo adaptador
 * que extiende la clase ProviderClass (la cual es como una interfaz para saber qué funciones son requeridas).
 * https://github.com/wppconnect-team/wppconnect
 */
defaultLogger.transports.forEach((t) => (t.silent = true)) //<==
class WPPConnectProviderClass extends ProviderClass {
    globalVendorArgs = { name: 'bot', port: 3000 }
    vendor: Whatsapp
    wppConnectProvider: any
    http: WPPConnectHttpServer | undefined
    constructor(args: { name: string }) {
        super()
        this.globalVendorArgs = { ...this.globalVendorArgs, ...args }
        this.initWppConnect().then()
        this.http = new WPPConnectHttpServer(this.globalVendorArgs.name, this.globalVendorArgs.port)
    }

    /**
     *
     * @param port
     */
    initHttpServer(port: number) {
        const methods: BotCtxMiddleware = {
            sendMessage: this.sendMessage,
            provider: this.vendor,
        }
        this.http.start(methods, port)
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
                catchQR: (base64Qrimg, _, attempt) => {
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
            func: (payload: Message & { lat?: string; lng?: string; name: string }) => {
                if (payload.from === 'status@broadcast') {
                    return
                }
                if (!WppConnectValidNumber(payload.from)) {
                    return
                }
                payload.from = WppConnectCleanNumber(payload.from, false)
                payload.name = `${payload?.author}`

                if (payload.hasOwnProperty('type') && ['image', 'video'].includes(payload.type)) {
                    payload = { ...payload, body: utils.generateRefprovider('_event_media_') }
                }
                if (payload.hasOwnProperty('type') && ['document'].includes(payload.type)) {
                    payload = { ...payload, body: utils.generateRefprovider('_event_document_') }
                }
                if (payload.hasOwnProperty('type') && ['ptt'].includes(payload.type)) {
                    payload = { ...payload, body: utils.generateRefprovider('_event_voice_note_') }
                }
                if (payload.hasOwnProperty('lat') && payload.hasOwnProperty('lng')) {
                    const lat = payload.lat
                    const lng = payload.lng
                    if (lat !== '' && lng !== '') {
                        payload = { ...payload, body: utils.generateRefprovider('_event_location_') }
                    }
                }
                // Emitir el evento "message" con el payload modificado
                this.emit('message', payload)
            },
        },
        {
            event: 'onPollResponse',
            func: async (payload: any) => {
                const selectedOption = payload.selectedOptions.find((option: { name: any }) => option && option.name)

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
            if (this.vendor[event]) this.vendor[event]((payload: any) => func(payload))
        }
    }

    /**
     * Enviar mensaje con botones
     * @param {string} number
     * @param {string} text
     * @param {Array} buttons
     * @example await sendButtons("+XXXXXXXXXXX", "Your Text", [{"body": "Button 1"},{"body": "Button 2"}])
     */
    sendButtons = async (number: any, text: any, buttons: any[]) => {
        this.emit(
            'notice',
            [
                `[NOTA]: Actualmente enviar botones no esta disponible con este proveedor`,
                `[NOTA]: esta funcion esta disponible con Meta o Twilio`,
            ].join('\n')
        )

        const templateButtons = buttons.map((btn: { body: any }, i: any) => ({
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

    sendPoll = async (number: any, text: any, poll: { options: string[]; multiselect: any }) => {
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

    sendPtt = async (number: any, audioPath: string) => {
        return this.vendor.sendPtt(number, audioPath)
    }

    /**
     * Enviar imagen
     * @param {string} number - The phone number to send the image to.
     * @param {string} filePath - The path to the image file.
     * @param {string} text - The text to accompany the image.
     * @returns {Promise<any>} - A promise representing the result of sending the image.
     */
    sendImage = async (number: string, filePath: string, text: string): Promise<any> => {
        return this.vendor.sendImage(number, filePath, 'image-name', text)
    }

    /**
     *
     * @param {string} number
     * @param {string} filePath
     * @example await sendMessage('+XXXXXXXXXXX', './document/file.pdf')
     */

    sendFile = async (number: any, filePath: string, text: any) => {
        const fileName = filePath.split('/').pop()
        return this.vendor.sendFile(number, filePath, fileName, text)
    }

    /**
     * Enviar video
     * @param {string} number - El número de teléfono al que se enviará el video.
     * @param {string} filePath - La ruta al archivo de video.
     * @param {string} text - El texto que acompañará al video.
     * @returns {Promise<{
     *    ack: number;
     *    id: string;
     *    sendMsgResult: SendMsgResult;
     *  }>} - Una promesa que representa el resultado de enviar el video.
     */
    sendVideo = async (number: string, filePath: string, text: string): Promise<any> => {
        return this.vendor.sendVideoAsGif(number, filePath, 'video.gif', text)
    }

    /**
     * Enviar imagen o multimedia
     * @param {*} number
     * @param {*} mediaInput
     * @param {*} message
     * @returns
     */
    sendMedia = async (number: any, mediaUrl: string, text: any) => {
        const fileDownloaded = await utils.generalDownload(mediaUrl)
        const mimeType = mime.lookup(fileDownloaded)
        if (`${mimeType}`.includes('image')) return this.sendImage(number, fileDownloaded, text)
        if (`${mimeType}`.includes('video')) return this.sendVideo(number, fileDownloaded, text)
        if (`${mimeType}`.includes('audio')) {
            const fileOpus = await utils.convertAudio(fileDownloaded)
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
    sendMessage = async (number: string, message: string, options?: SendOptions): Promise<any> => {
        options = { ...options, ...options['options'] }
        if (options?.buttons?.length) return this.sendButtons(number, message, options.buttons)
        if (options?.media) return this.sendMedia(number, options.media, message)
        return this.vendor.sendText(number, message)
    }

    private generateFileName = (extension: string): string => `file-${Date.now()}.${extension}`

    saveFile = async (ctx: Partial<Message & BotContext>, options: SaveFileOptions = {}): Promise<string> => {
        try {
            const { mimetype } = ctx
            const buffer = await this.vendor.decryptFile(ctx as Message)
            const extension = mime.extension(mimetype) as string
            const fileName = this.generateFileName(extension)
            const pathFile = join(options?.path ?? tmpdir(), fileName)
            await writeFile(pathFile, buffer)
            return pathFile
        } catch (err) {
            console.log(`[Error]:`, err.message)
            return 'ERROR'
        }
    }
}

export { WPPConnectProviderClass }
