import twilio from 'twilio'
import { ProviderClass, UTILS } from '@bot-whatsapp/bot'
import { parseNumber } from './utils'
import { TwilioWebHookServer } from './server'

interface ITwilioProviderOptions {
    accountSid: string
    authToken: string
    vendorNumber: string
    port?: number
    publicUrl?: string
}

interface IMessageOptions {
    buttons?: any[]
    media?: string
}

class TwilioProvider extends ProviderClass {
    private twilioServer: TwilioWebHookServer
    private vendor: twilio.Twilio
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
        const ecrypPath = UTILS.encryptData(encodeURIComponent(mediaInput))
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

    public async senadMessage(userId: string | number, message: Message): Promise<Message> {}

    public async sendMessage(
        number: string,
        message: string,
        { options }: { options?: IMessageOptions } = {}
    ): Promise<any> {
        number = parseNumber(number)
        if (options?.buttons?.length) await this.sendButtons()
        if (options?.media) return this.sendMedia(number, message, options.media)
        return this.vendor.messages.create({
            body: message,
            from: `whatsapp:+${this.vendorNumber}`,
            to: `whatsapp:+${number}`,
        })
    }
}

export { TwilioProvider }
