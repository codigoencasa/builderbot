const ProviderClass = require('../packages/bot/provider/provider.class')
class MockProvider extends ProviderClass {
    constructor() {
        super()
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
}

module.exports = MockProvider
