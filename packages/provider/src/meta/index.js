const { ProviderClass } = require('@bot-whatsapp/bot')
const axios = require('axios')
const MetaWebHookServer = require('./server')
const URL = `https://graph.facebook.com/v15.0`

/**
 * ⚙️MetaProvider: Es un provedor que te ofrece enviar
 * mensaje a Whatsapp via API
 * info: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 *
 *
 * Necesitas las siguientes tokens y valores
 * { jwtToken, numberId, vendorNumber, verifyToken }
 */
const PORT = process.env.PORT || 3000

class MetaProvider extends ProviderClass {
    metHook
    jwtToken
    numberId
    constructor({ jwtToken, numberId, verifyToken, port = PORT }) {
        super()
        this.jwtToken = jwtToken
        this.numberId = numberId
        this.metHook = new MetaWebHookServer(verifyToken, port)
        this.metHook.start()

        const listEvents = this.busEvents()

        for (const { event, func } of listEvents) {
            this.metHook.on(event, func)
        }
    }

    /**
     * Mapeamos los eventos nativos a los que la clase Provider espera
     * para tener un standar de eventos
     * @returns
     */
    busEvents = () => [
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

    sendMessageMeta = async (body) => {
        try {
            const response = await axios.post(`${URL}/${this.numberId}/messages`, body, {
                headers: {
                    Authorization: `Bearer ${this.jwtToken}`,
                },
            })
            return response.data
        } catch (error) {
            return Promise.resolve(error)
        }
    }

    sendtext = async (number, message) => {
        const body = {
            messaging_product: 'whatsapp',
            to: number,
            type: 'text',
            text: {
                preview_url: false,
                body: message,
            },
        }
        await this.sendMessageMeta(body)
    }

    sendMedia = async (number, _, mediaInput = null) => {
        if (!mediaInput) throw new Error(`MEDIA_INPUT_NULL_: ${mediaInput}`)
        const body = {
            messaging_product: 'whatsapp',
            to: number,
            type: 'image',
            image: {
                link: mediaInput,
            },
        }
        await this.sendMessageMeta(body)
    }

    /**
     *
     * @param {*} userId
     * @param {*} message
     * @param {*} param2
     * @returns
     */
    sendMessage = async (number, message, { options }) => {
        if (options?.buttons?.length) return console.log('Envio de botones')
        if (options?.media) return this.sendMedia(number, message, options.media)

        this.sendtext(number, message)
    }
}

module.exports = MetaProvider
