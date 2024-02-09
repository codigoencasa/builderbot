import { ProviderClass, utils } from '@bot-whatsapp/bot'
import { SendOptions } from '@bot-whatsapp/bot/dist/types'
import { Console } from 'console'
import { createWriteStream } from 'fs'
import mime from 'mime-types'
import venom from 'venom-bot'

import { VenomHttpServer } from './server'
import { BotCtxMiddleware } from './types'
import { venomCleanNumber, venomGenerateImage, venomisValidNumber } from './utils'

const logger = new Console({
    stdout: createWriteStream(`${process.cwd()}/venom.log`),
})

/**
 * ⚙️ VenomProvider: Es una clase tipo adaptor
 * que extiende clases de ProviderClass (la cual es como interfaz para sber que funciones rqueridas)
 * https://github.com/orkestral/venom
 */
class VenomProvider extends ProviderClass {
    globalVendorArgs = { name: `bot`, gifPlayback: false, port: 3000 }
    vendor: venom.Whatsapp
    http: VenomHttpServer | undefined
    constructor(args: { name: string; gifPlayback: boolean }) {
        super()
        this.globalVendorArgs = { ...this.globalVendorArgs, ...args }
        this.http = new VenomHttpServer(this.globalVendorArgs.name, this.globalVendorArgs.port)
        this.init().then(() => this.initBusEvents())
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
     * Iniciamos el Proveedor Venom
     */
    init = async () => {
        const NAME_DIR_SESSION = `${this.globalVendorArgs.name}_sessions`
        try {
            const client = await venom.create(
                NAME_DIR_SESSION,
                (base) => this.generateQr(base),
                (info) => console.log({ info }),
                {
                    disableSpins: true,
                    disableWelcome: true,
                    logQR: false,
                }
            )

            this.vendor = client
            this.emit('ready', true)
        } catch (e) {
            logger.log(e)
            this.emit('auth_failure', {
                instructions: [
                    `Ocurrio un error con la inicializacion de venom`,
                    `Reinicia el BOT`,
                    `Tambien puedes mirar un log que se ha creado venom.log`,
                    `(Puedes abrir un ISSUE) https://github.com/codigoencasa/bot-whatsapp/issues/new/choose`,
                ],
            })
        }
    }

    /**
     * Generamos QR Code pra escanear con el Whatsapp
     */
    generateQr = async (qr: string) => {
        console.clear()
        this.emit('require_action', {
            instructions: [
                `Debes escanear el QR Code para iniciar ${this.globalVendorArgs.name}.qr.png`,
                `Recuerda que el QR se actualiza cada minuto `,
                `Necesitas ayuda: https://link.codigoencasa.com/DISCORD`,
            ],
        })
        await venomGenerateImage(qr, `${this.globalVendorArgs.name}.qr.png`)
    }

    /**
     * Mapeamos los eventos nativos de  https://docs.orkestral.io/venom/#/?id=events
     * para tener un standar de eventos
     * @returns
     */
    busEvents = () => [
        {
            event: 'onMessage',
            func: (payload: venom.Message & { lat?: string; lng?: string; name: string }) => {
                if (payload.from === 'status@broadcast') {
                    return
                }
                if (!venomisValidNumber(payload.from)) {
                    return
                }

                payload.from = venomCleanNumber(payload.from, true)
                payload.name = `${payload.sender?.pushname}`

                if (payload.hasOwnProperty('type') && ['image', 'video'].includes(payload.type)) {
                    payload = {
                        ...payload,
                        body: utils.generateRefprovider('_event_media_'),
                    }
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
                this.emit('message', payload)
            },
        },
    ]

    /**
     * Iniciamos y mapeamos el BusEvent
     * Ejemplo:
     * this.vendor.onMessage() 👉 this.vendor["onMessage"]()
     */
    initBusEvents = () => {
        const listEvents = this.busEvents()

        for (const { event, func } of listEvents) {
            if (this.vendor[event])
                this.vendor[event]((payload: venom.Message & { lat?: string; lng?: string; name: string }) =>
                    func(payload)
                )
        }
    }

    /**
     * Enviar botones
     * @private
     * @param {*} number
     * @param {*} message
     * @param {*} buttons []
     * @returns
     */
    sendButtons = async (number: string, message: any, buttons = []) => {
        this.emit(
            'notice',
            [
                `[NOTA]: Actualmente enviar botones no esta disponible con este proveedor`,
                `[NOTA]: esta funcion esta disponible con Meta o Twilio`,
            ].join('\n')
        )
        const buttonToStr = [message].concat(buttons.map((btn) => `${btn.body}`)).join(`\n`)
        return this.vendor.sendText(number, buttonToStr)
        // return this.vendor.sendButtons(number, "Title", buttons1, "Description");
    }

    /**
     * Enviar audio
     * @alpha
     * @param {string} number
     * @param {string} message
     * @param {boolean} voiceNote optional
     * @example await sendMessage('+XXXXXXXXXXX', 'audio.mp3')
     */

    sendAudio = async (number: string, audioPath: string) => {
        return this.vendor.sendVoice(number, audioPath)
    }

    /**
     * Enviar imagen
     * @param {*} number
     * @param {*} imageUrl
     * @param {*} text
     * @returns
     */
    sendImage = async (number: string, filePath: string, text: string) => {
        return this.vendor.sendImage(number, filePath, 'image-name', text)
    }

    /**
     *
     * @param {string} number
     * @param {string} filePath
     * @example await sendMessage('+XXXXXXXXXXX', './document/file.pdf')
     */

    sendFile = async (number: string, filePath: string, text: string) => {
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
    sendVideo = async (number: string, filePath: string, text: string) => {
        return this.vendor.sendVideoAsGif(number, filePath, 'video.gif', text)
    }

    /**
     * Enviar imagen o multimedia
     * @param {*} number
     * @param {*} mediaInput
     * @param {*} message
     * @returns
     */
    sendMedia = async (number: string, mediaUrl: string, text: string) => {
        const fileDownloaded = await utils.generalDownload(mediaUrl)
        const mimeType = mime.lookup(fileDownloaded)
        if (`${mimeType}`.includes('image')) return this.sendImage(number, fileDownloaded, text)
        if (`${mimeType}`.includes('video')) return this.sendVideo(number, fileDownloaded, text)
        if (`${mimeType}`.includes('audio')) {
            const fileOpus = await utils.convertAudio(fileDownloaded, 'mp3')
            return this.sendAudio(number, fileOpus)
        }

        return this.sendFile(number, fileDownloaded, text)
    }

    /**
     * Enviar mensaje al usuario
     * @param {*} userId
     * @param {*} message
     * @param {*} param2
     * @returns
     */
    sendMessage = async (number: string, message: string, options: SendOptions): Promise<any> => {
        number = venomCleanNumber(number)
        if (options?.buttons?.length) return this.sendButtons(number, message, options.buttons)
        if (options?.media) return this.sendMedia(number, options.media, message)
        return this.vendor.sendText(number, message)
    }
}

export { VenomProvider }
