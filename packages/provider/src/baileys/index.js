const { ProviderClass } = require('@bot-whatsapp/bot')
const PINO = require('pino')
const makeWASocket = require('@adiwajshing/baileys').default
const { useMultiFileAuthState } = require('@adiwajshing/baileys')

class Baileys extends ProviderClass {
    constructor() {
        super()
        this.sock
    }

    async baileys() {
        const { state, saveCreds } = await useMultiFileAuthState(
            'baileys_auth_whatsapp'
        )

        this.sock = await makeWASocket({
            printQRInTerminal: true,
            auth: state,
            logger: PINO({ level: 'error' }),
        })

        this.sock.ev.on(
            'connection.update',
            ({ connection, lastDisconnect }) => {
                if (lastDisconnect?.error) {
                    saveCreds()

                    this.baileys()
                }

                if (connection === 'open') {
                    console.log('Baileys is connected')
                }
            }
        )
    }

    /**
     *
     * @param {string} number
     * @param {string} message
     * @example await sendMessage('+51925465621', 'Hello World')
     */
    async sendMessage(number, message) {
        const numberClean = number.replace('+', '')
        await this.sock.sendMessage(`${numberClean}@c.us`, { text: message })
    }

    /**
     *
     * @param {string} number
     * @param {string} message
     * @example await sendMessage('+51925465621', 'https://dominio.com/imagen.jpg' | 'img/imagen.jpg')
     */

    async sendImage(number, imageUrl) {
        const numberClean = number.replace('+', '')
        await this.sock.sendMessage(`${numberClean}@c.us`, {
            image: { url: imageUrl },
        })
    }

    /**
     *
     * @param {string} number
     * @param {string} message
     * @param {boolean} voiceNote optional
     * @example await sendMessage('+51925465621', 'audio.mp3')
     */

    async sendAudio(number, audioUrl, voiceNote = false) {
        const numberClean = number.replace('+', '')
        await this.sock.sendMessage(`${numberClean}@c.us`, {
            audio: { url: audioUrl },
            ptt: voiceNote,
        })
    }
}
