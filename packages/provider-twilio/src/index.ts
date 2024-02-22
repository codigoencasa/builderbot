import { ProviderClass, utils } from '@bot-whatsapp/bot'
import { Vendor } from '@bot-whatsapp/bot/dist/provider/providerClass'
import { BotContext, BotCtxMiddleware, SendOptions } from '@bot-whatsapp/bot/dist/types'
import { tmpdir } from 'os'
import { join } from 'path'
import twilio from 'twilio'

import { TwilioWebHookServer } from './server'
import { ITwilioProviderOptions, TwilioRequestBody } from './types'
import { parseNumber } from './utils'

class TwilioProvider extends ProviderClass {
    public http: TwilioWebHookServer
    public vendor: Vendor<twilio.Twilio>
    private vendorNumber: string
    private publicUrl: string

    constructor({
        accountSid,
        authToken,
        vendorNumber,
        port = Number(process.env.PORT) || 3000,
        publicUrl = '',
    }: ITwilioProviderOptions) {
        super()
        this.publicUrl = publicUrl

        this.vendor = twilio(accountSid, authToken)
        this.vendorNumber = parseNumber(vendorNumber)
        this.initHttpServer(port)
        const listEvents = this.busEvents()
        for (const { event, func } of listEvents) {
            this.http.on(event, func)
        }
    }

    private busEvents(): Array<{ event: string; func: (payload?: any) => void }> {
        return [
            {
                event: 'auth_failure',
                func: (payload) => this.emit('error', payload),
            },
            {
                event: 'ready',
                func: () => this.emit('ready', true),
            },
            {
                event: 'message',
                func: (payload) => {
                    this.emit('message', payload)
                },
            },
        ]
    }

    private async sendMedia(number: string, message: string, mediaInput: string | null): Promise<any> {
        if (!mediaInput) throw new Error(`MEDIA_INPUT_NULL_: ${mediaInput}`)
        const ecrypPath = utils.encryptData(encodeURIComponent(mediaInput))
        const urlEncode = `${this.publicUrl}/tmp?path=${ecrypPath}`
        const regexUrl = /^(?!https?:\/\/)[^\s]+$/
        const urlNotice = [
            `[NOTA]: Estas intentando enviar una fichero que esta en local.`,
            `[NOTA]: Para que esto funcione con Twilio necesitas que el fichero este en una URL publica`,
            `[NOTA]: más informacion aqui https://bot-whatsapp.netlify.app/docs/provider-twilio/`,
            `[NOTA]: Esta es la url que se enviara a twilio (debe ser publica) ${urlEncode}`,
        ].join('\n')

        if (
            mediaInput.includes('localhost') ||
            mediaInput.includes('127.0.0.1') ||
            mediaInput.includes('0.0.0.0') ||
            regexUrl.test(mediaInput)
        ) {
            mediaInput = urlEncode
            console.log(urlNotice)
        }

        number = parseNumber(number)
        return this.vendor.messages.create({
            mediaUrl: [`${mediaInput}`],
            body: message,
            from: `whatsapp:+${this.vendorNumber}`,
            to: `whatsapp:+${number}`,
        })
    }

    private async sendButtons(): Promise<void> {
        this.emit(
            'notice',
            [
                `[NOTA]: Actualmente enviar botones con Twilio está en desarrollo`,
                `[NOTA]: https://www.twilio.com/es-mx/docs/whatsapp/buttons`,
            ].join('\n')
        )
    }

    initHttpServer(port: number) {
        this.http = new TwilioWebHookServer(port)
        const methods: BotCtxMiddleware = {
            sendMessage: this.sendMessage,
            provider: this.vendor,
        }
        this.http.start(methods, port)
    }

    sendMessage = async (number: string, message: string, options?: SendOptions): Promise<any> => {
        options = { ...options, ...options['options'] }
        number = parseNumber(`${number}`)
        if (options?.buttons?.length) await this.sendButtons()
        if (options?.media) return this.sendMedia(number, message, options.media)
        const response = this.vendor.messages.create({
            body: message,
            from: `whatsapp:+${this.vendorNumber}`,
            to: `whatsapp:+${number}`,
        })
        return response
    }

    saveFile = async (ctx: Partial<TwilioRequestBody & BotContext>, options?: { path: string }): Promise<string> => {
        try {
            const pathFile = join(options?.path ?? tmpdir())
            const localPath = await utils.generalDownload(`${ctx?.MediaUrl0}`, pathFile)
            return localPath
        } catch (err) {
            console.log(`[Error]:`, err)
            return 'ERROR'
        }
    }
}

export { TwilioProvider }
