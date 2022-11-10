const { ProviderClass } = require('@bot-whatsapp/core')

class MockProvider extends ProviderClass {
    constructor() {
        super()
        this.init()
    }

    delaySendMessage = (miliseconds, eventName) =>
        new Promise((res) =>
            setTimeout(() => {
                const payload = { data: eventName }
                this.emit(eventName, payload)
                res
            }, miliseconds)
        )

    sendMessage = async (userId, message) => {
        return Promise.resolve({ userId, message })
    }

    init = () =>
        Promise.all([
            this.delaySendMessage(500, 'ready'),
            this.delaySendMessage(1500, 'message'),
        ])
}

module.exports = new MockProvider()
