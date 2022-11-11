const { test } = require('uvu')
const assert = require('uvu/assert')
const MockProvider = require('../adapters/mock')

test(`ProviderClass`, async () => {
    const provider = new MockProvider()
    const msg = await provider.sendMessage('123456789', 'hola')
    console.log(msg)
    assert.is(msg.userId, '123456789')
    assert.is(msg.message, 'hola')
})

test.run()
