const ProviderClass = require('../../core/classes/provider.class')

class MockSetting {
    enviar = async (number, msg) => {
        return Promise.resolve('1')
    }
}

const mock = new MockSetting()

class MockProvider extends ProviderClass {
    vendor
    constructor() {
        super()
        this.vendor = mock
    }

    sendMessage = async (userId, message) => {
        const status = await this.vendor.enviar(userId, message)
        return { userId, message, status }
    }
}

module.exports = MockProvider
