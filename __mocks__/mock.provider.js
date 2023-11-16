const ProviderClass = require('../packages/bot/provider/provider.class')
const { delay } = require('./env')
class MockProvider extends ProviderClass {
    constructor() {
        super()
    }

    delaySendMessage = async (miliseconds, eventName, payload) => {
        await delay(miliseconds)
        this.emit(eventName, payload)
    }

    sendMessage = async (userId, message) => {
        console.log(`Enviando... ${userId}, ${message}`)
        return Promise.resolve({ userId, message })
    }
}

module.exports = MockProvider
