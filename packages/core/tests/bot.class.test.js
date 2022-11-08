const { test } = require('uvu')
const assert = require('uvu/assert')
const BotClass = require('../classes/bot.class')

class MockDB {
    saveLog = () => {}
}

class MockProvider {
    sendMessage = () => {}
}

class MockFlow {
    find = () => {}
}

test(`BotClass emit ping`, () => {
    let messages = []

    const botBasic = new BotClass(
        new MockFlow(),
        new MockDB(),
        new MockProvider()
    )

    botBasic.on('message', (ctx) => messages.push(ctx))
    botBasic.emit('message', 'ping')

    assert.is(messages.join(''), 'ping')
})

test.run()
