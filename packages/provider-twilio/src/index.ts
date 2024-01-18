import { ProviderClass, utils } from '@bot-whatsapp/bot'
import { Button } from '@bot-whatsapp/bot/dist/types'
import twilio from 'twilio'

import { TwilioWebHookServer } from './server'
import { parseNumber } from './utils'
import { Vendor } from '@bot-whatsapp/bot/dist/provider/providerClass'
import { Message } from 'twilio/lib/twiml/MessagingResponse'

export interface ITwilioProviderOptions {
    accountSid: string
    authToken: string
    vendorNumber: string
    port?: number
    publicUrl?: string
}

export interface IMessageOptions {
    buttons?: Button[]
    media?: string
}

class TwilioProvider extends ProviderClass {
    public twilioServer: TwilioWebHookServer
    protected vendor: Vendor<twilio.Twilio>
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
        this.twilioServer = new TwilioWebHookServer(port)
        this.vendorNumber = parseNumber(vendorNumber)

        this.twilioServer.start()
        const listEvents = this.busEvents()
        for (const { event, func } of listEvents) {
            this.twilioServer.on(event, func)
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
            console.log(urlNotice)
            mediaInput = urlEncode
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

    public async sendMessage(
        number: string | number,
        { message }: Message,
        { options }: { options?: IMessageOptions } = {}
    ): Promise<Message> {
        number = parseNumber(`${number}`)
        if (options?.buttons?.length) await this.sendButtons()
        if (options?.media) return this.sendMedia(number, message, options.media)
        const respone = this.vendor.messages.create({
            body: message,
            from: `whatsapp:+${this.vendorNumber}`,
            to: `whatsapp:+${number}`,
        })
        return respone as unknown as Message
    }
}

export { TwilioProvider }
