const { ProviderClass } = require('../../../bot')

function delay(ms) {
    return new Promise((res) => setTimeout(res, ms))
}

class MockProvider extends ProviderClass {
    constructor() {
        super()
    }

    delaySendMessage = async (miliseconds, eventName, payload) => {
        await delay(miliseconds)
        this.emit(eventName, payload)
    }

    sendMessage = async (userId, message) => {
        return Promise.resolve({ userId, message })
    }
}

module.exports = MockProvider
