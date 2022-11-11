const { ProviderClass } = require('@bot-whatsapp/core')

class MockProvider extends ProviderClass {
    constructor() {
        super()
        this.init()
    }

    delaySendMessage = (miliseconds, eventName, payload) =>
        new Promise((res) =>
            setTimeout(() => {
                this.emit(eventName, payload)
                res
            }, miliseconds)
        )

    sendMessage = async (userId, message) => {
        console.log(`Enviando... ${userId}, ${message}`)
        return Promise.resolve({ userId, message })
    }

    init = () =>
        Promise.all([
            this.delaySendMessage(500, 'ready', null),
            this.delaySendMessage(1500, 'message', {
                from: 'XXXXXX',
                body: 'ola',
                hasMedia: false,
            }),
        ])
}

module.exports = new MockProvider()
