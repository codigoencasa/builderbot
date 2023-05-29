const { ProviderClass } = require('@bot-whatsapp/bot')
const axios = require('axios')
const MetaWebHookServer = require('./server')
const URL = `https://graph.facebook.com`

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
    metHook = undefined
    jwtToken = undefined
    numberId = undefined
    version = 'v16.0'

    constructor({ jwtToken, numberId, verifyToken, version, port = PORT }) {
        super()
        this.jwtToken = jwtToken
        this.numberId = numberId
        this.version = version
        this.metHook = new MetaWebHookServer(jwtToken, numberId, version, verifyToken, port)
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

    /**
     * Enviar directo a META
     * @param {*} body
     * @returns
     */
    sendMessageMeta = async (body) => {
        try {
            const response = await axios.post(`${URL}/${this.version}/${this.numberId}/messages`, body, {
                headers: {
                    Authorization: `Bearer ${this.jwtToken}`,
                },
            })
            return response.data
        } catch (error) {
            console.log(error)
            return Promise.resolve(error)
        }
    }

    sendtext = async (number, message) => {
        const body = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: number,
            type: 'text',
            text: {
                preview_url: false,
                body: message,
            },
        }
        return this.sendMessageMeta(body)
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
        return this.sendMessageMeta(body)
    }

    /**
     * Enviar listas
     * @param {*} number
     * @param {*} text
     * @param {*} buttons
     * @returns
     */
    sendLists = async (number, list) => {
        const parseList = { ...list, ...{ type: 'list' } }
        const body = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: number,
            type: 'interactive',
            interactive: parseList,
        }
        return this.sendMessageMeta(body)
    }

    /**
     * Enviar listas alternativo
     * @param {*} number
     * @param {*} header
     * @param {*} text
     * @param {*} footer
     * @param {*} button
     * @param {*} list
     * @returns
     */
    sendList = async (number, header, text, footer, button, list) => {
        const parseList = list.map((list) => ({
            title: list.title,
            rows: list.rows.map((row) => ({
                id: row.id,
                title: row.title,
                description: row.description,
            })),
        }))

        const body = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: number,
            type: 'interactive',
            interactive: {
                type: 'list',
                header: {
                    type: 'text',
                    text: header,
                },
                body: {
                    text: text,
                },
                footer: {
                    text: footer,
                },
                action: {
                    button: button,
                    sections: parseList,
                },
            },
        }
        return this.sendMessageMeta(body)
    }
    /**
     * Enviar buttons
     * @param {*} number
     * @param {*} text
     * @param {*} buttons
     * @returns
     */
    sendButtons = async (number, text, buttons) => {
        const parseButtons = buttons.map((btn, i) => ({
            type: 'reply',
            reply: {
                id: `btn-${i}`,
                title: btn.body,
            },
        }))

        const body = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: number,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: {
                    text: text,
                },
                action: {
                    buttons: parseButtons,
                },
            },
        }
        return this.sendMessageMeta(body)
    }

    /**
     *
     * @param {*} userId
     * @param {*} message
     * @param {*} param2
     * @returns
     */
    sendMessage = async (number, message, { options }) => {
        if (options?.buttons?.length) return this.sendButtons(number, message, options.buttons)
        if (options?.media) return this.sendMedia(number, message, options.media)

        this.sendtext(number, message)
    }
}

module.exports = MetaProvider
