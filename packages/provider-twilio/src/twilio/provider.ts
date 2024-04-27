import { ProviderClass, utils } from '@builderbot/bot'
import type { BotContext, SendOptions } from '@builderbot/bot/dist/types'
import { tmpdir } from 'os'
import { join } from 'path'
import type { MessageListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/message'

import { TwilioCoreVendor } from './core'
import type { TwilioInterface } from '../interface/twilio'
import type { ITwilioProviderARgs, TwilioRequestBody } from '../types'
import { parseNumberFrom } from '../utils'
/**
 * A class representing a TwilioProvider for interacting with Twilio messaging service.
 * @extends ProviderClass
 * @implements {TwilioInterface}
 */
class TwilioProvider extends ProviderClass<TwilioCoreVendor> implements TwilioInterface {
    globalVendorArgs: ITwilioProviderARgs

    constructor(args: ITwilioProviderARgs) {
        super()
        this.globalVendorArgs = {
            accountSid: undefined,
            authToken: undefined,
            vendorNumber: undefined,
            name: 'bot',
            port: 3000,
            writeMyself: 'none',
        }
        this.globalVendorArgs = { ...this.globalVendorArgs, ...args }
    }

    /**
     * Initialize the vendor for TwilioProvider.
     * @returns {Promise<any>} A Promise that resolves when vendor is initialized.
     * @protected
     */
    protected async initVendor(): Promise<any> {
        const vendor = new TwilioCoreVendor(this.globalVendorArgs)
        this.vendor = vendor
        return Promise.resolve(vendor)
    }

    protected beforeHttpServerInit(): void {
        this.server = this.server
            .use((req, _, next) => {
                req['globalVendorArgs'] = this.globalVendorArgs
                return next()
            })
            .post('/', this.vendor.indexHome)
            .post('/webhook', this.vendor.incomingMsg)
            .get('/tmp', this.vendor.handlerLocalMedia)
    }

    protected afterHttpServerInit(): void {}

    /**
     * Event handlers for bus events.
     */
    busEvents = () => [
        {
            event: 'auth_failure',
            func: (payload: any) => this.emit('auth_failure', payload),
        },
        {
            event: 'ready',
            func: () => this.emit('ready', true),
        },
        {
            event: 'message',
            func: (payload: BotContext) => {
                this.emit('message', payload)
            },
        },
        {
            event: 'host',
            func: (payload: any) => {
                this.emit('host', payload)
            },
        },
    ]

    /**
     * Sends media content via Twilio.
     * @param {string} number - The recipient's phone number.
     * @param {string} [message=''] - The message to be sent.
     * @param {string} mediaInput - The media input to be sent.
     * @returns {Promise<any>} A Promise that resolves when the media is sent.
     */
    sendMedia = async (number: string, message: string = '', mediaInput: string): Promise<any> => {
        const entryPointUrl = this.globalVendorArgs?.publicUrl ?? `http://localhost:${this.globalVendorArgs.port}`
        if (!mediaInput) throw new Error(`Media cannot be null`)
        const encryptPath = utils.encryptData(encodeURIComponent(mediaInput))
        const urlEncode = `${entryPointUrl}/tmp?path=${encryptPath}`
        const regexUrl = /^(?!https?:\/\/)[^\s]+$/
        const instructions = [
            `You are trying to send a file that is local.`,
            `For this to work with Twilio, the file needs to be in a public URL.`,
            `More information here https://builderbot.vercel.app/en/twilio/uses-cases`,
            `This is the URL that will be sent to Twilio (must be public)`,
            ``,
            `${urlEncode}`,
        ]

        if (
            mediaInput.includes('localhost') ||
            mediaInput.includes('127.0.0.1') ||
            mediaInput.includes('0.0.0.0') ||
            regexUrl.test(mediaInput)
        ) {
            mediaInput = urlEncode

            this.emit('notice', {
                title: '🟠  WARNING 🟠',
                instructions,
            })
        }

        try {
            const twilioQueue = this.vendor.twilio.messages.create({
                mediaUrl: [`${mediaInput}`],
                body: message,
                from: parseNumberFrom(this.globalVendorArgs.vendorNumber),
                to: parseNumberFrom(number),
            })

            return twilioQueue
        } catch (err) {
            console.log(`Error Twilio:`, err)
        }
    }

    /**
     * Sends buttons via Twilio.
     * @returns {Promise<void>} A Promise that resolves when buttons are sent.
     */
    sendButtons = async (): Promise<void> => {
        this.emit('notice', {
            title: '📃 INFO 📃',
            instructions: [
                `Twilio presents a different way to implement buttons and lists`,
                `To understand more about how it works, I recommend you check the following URLs`,
                `https://builderbot.vercel.app/en/providers/twilio/uses-cases`,
            ],
        })
    }

    /**
     *
     * @param number
     * @param message
     * @returns
     */
    send = async (number: string, message: string, options?: MessageListInstanceCreateOptions): Promise<any> => {
        const response = await this.vendor.twilio.messages.create({
            ...options,
            body: message,
            from: parseNumberFrom(this.globalVendorArgs.vendorNumber),
            to: parseNumberFrom(number),
        })
        return response
    }

    /**
     * Sends a message via Twilio.
     * @param {string} number - The recipient's phone number.
     * @param {string} message - The message to be sent.
     * @param {SendOptions} [options] - The options for sending the message.
     * @returns {Promise<any>} A Promise that resolves when the message is sent.
     */
    sendMessage = async (number: string, message: string, options?: SendOptions): Promise<any> => {
        options = { ...options, ...options['options'] }
        if (options?.buttons?.length) await this.sendButtons()
        if (options?.media) return this.sendMedia(number, message, options.media)
        const response = this.vendor.twilio.messages.create({
            body: message,
            from: parseNumberFrom(this.globalVendorArgs.vendorNumber),
            to: parseNumberFrom(number),
        })
        return response
    }

    /**
     * Saves a file received via Twilio.
     * @param {Partial<TwilioRequestBody & BotContext>} ctx - The context containing the received file.
     * @param {{ path: string }} [options] - The options for saving the file.
     * @returns {Promise<string>} A Promise that resolves with the saved file path.
     */
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
