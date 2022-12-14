const { ProviderClass } = require('@bot-whatsapp/bot')
const venom = require('venom-bot')
const {
    venomCleanNumber,
    venomGenerateImage,
    venomisValidNumber,
} = require('./utils/utils')

/**
 * ⚙️ VenomProvider: Es una clase tipo adaptor
 * que extiende clases de ProviderClass (la cual es como interfaz para sber que funciones rqueridas)
 * https://github.com/orkestral/venom
 */
class VenomProvider extends ProviderClass {
    vendor

    constructor() {
        super()
        this.init().then(() => this.initBusEvents())
    }

    /**
     * Iniciamos el Proveedor Venom
     */
    init = async () => {
        try {
            const client = await venom.create(
                {
                    session: 'session-base',
                    multidevice: true,
                },
                (base) => this.generateQr(base),
                undefined,
                { logQR: false }
            )
            this.vendor = client
        } catch (e) {
            this.emit('auth_failure', {
                instructions: [
                    `Ocurrio un error con la inicializacion de venom`,
                    `Necesitas ayuda: https://link.codigoencasa.com/DISCORD`,
                    `(Puedes abrir un ISSUE) https://github.com/leifermendez/bot-whatsapp/issues/new/choose`,
                    ``,
                    `${e?.message}`,
                ],
            })
        }
    }

    /**
     * Generamos QR Code pra escanear con el Whatsapp
     */
    generateQr = (qr) => {
        console.clear()
        this.emit('require_action', {
            instructions: [
                `Debes escanear el QR Code para iniciar session reivsa qr.png`,
                `Recuerda que el QR se actualiza cada minuto `,
                `Necesitas ayuda: https://link.codigoencasa.com/DISCORD`,
            ],
        })
        venomGenerateImage(qr)
    }

    /**
     * Mapeamos los eventos nativos de  https://docs.orkestral.io/venom/#/?id=events
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

                if (!venomisValidNumber(payload.from)) {
                    return
                }
                payload.from = venomCleanNumber(payload.from, true)
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
                this.vendor[event]((payload) => func(payload))
        }
    }

    /**
     * Enviar mensaje al usuario
     * @param {*} userId
     * @param {*} message
     * @param {*} param2
     * @returns
     */
    sendMessage = async (userId, message, { options }) => {
        const number = venomCleanNumber(userId)
        if (options?.buttons?.length)
            return this.sendButtons(number, message, options.buttons)
        if (options?.media) return this.sendMedia(number, options.media)
        return this.vendor.sendText(number, message)
    }
}

module.exports = VenomProvider
