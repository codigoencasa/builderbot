const { EventEmitter } = require('node:events')
const { test } = require('uvu')
const assert = require('uvu/assert')
const { create } = require('../')
const BotClass = require('../classes/bot.class')

class MockFlow {}

class MockDB {}

class MockProvider extends EventEmitter {}

test(`BotClass`, async () => {
    const setting = {
        flow: new MockFlow(),
        database: new MockDB(),
        provider: new MockProvider(),
    }
    const bot = await create(setting)
    assert.is(bot instanceof BotClass, true)
})

test.run()
