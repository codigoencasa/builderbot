const { EventEmitter } = require('node:events')

class MockProvider extends EventEmitter {
    delaySendMessage = (miliseconds, eventName, payload) =>
        new Promise((res) =>
            setTimeout(() => {
                this.emit(eventName, payload)
                res
            }, miliseconds)
        )

    sendMessage = async (userId, message) => {
        return Promise.resolve({ userId, message })
    }
}

module.exports = MockProvider
