import { ProviderClass, utils } from '@builderbot/bot'
import { Vendor } from '@builderbot/bot/dist/provider/providerClass'
import { BotContext, BotCtxMiddleware, BotCtxMiddlewareOptions, SendOptions } from '@builderbot/bot/dist/types'
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

    constructor({ accountSid, authToken, vendorNumber, publicUrl = '' }: ITwilioProviderOptions) {
        super()
        this.publicUrl = publicUrl
        this.vendor = twilio(accountSid, authToken)
        this.vendorNumber = parseNumber(vendorNumber)
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
        if (!mediaInput) throw new Error(`Media cannot be null`)
        const encryptPath = utils.encryptData(encodeURIComponent(mediaInput))
        const urlEncode = `${this.publicUrl}/tmp?path=${encryptPath}`
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

    private listenOnEvents = () => {
        const listEvents = this.busEvents()
        for (const { event, func } of listEvents) {
            this.http.on(event, func)
        }
    }

    /**
     *
     * @param port
     * @param opts
     * @returns
     */
    initHttpServer = (port: number, opts: Pick<BotCtxMiddlewareOptions, 'blacklist'>) => {
        this.http = new TwilioWebHookServer(port)
        const methods: BotCtxMiddleware<TwilioProvider> = {
            sendMessage: this.sendMessage,
            provider: this.vendor,
            blacklist: opts.blacklist,
            dispatch: (customEvent, payload) => {
                this.emit('message', {
                    ...payload,
                    body: utils.setEvent(customEvent),
                    name: payload.name,
                    from: utils.removePlus(payload.from),
                })
            },
        }

        this.http.start(methods, port, { botName: this.globalVendorArgs.name }, (routes) => {
            this.emit('notice', {
                title: '🛜  HTTP Server ON ',
                instructions: routes,
            })

            this.emit('notice', {
                title: '⚡⚡ SETUP TWILIO ⚡⚡',
                instructions: [
                    `Add "Webhook" WHEN A MESSAGE COMES IN`,
                    `http://localhost:${port}/webhook`,
                    `More info https://builderbot.vercel.app/en/providers/twilio`,
                ],
            })
        })

        this.listenOnEvents()
        return
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
