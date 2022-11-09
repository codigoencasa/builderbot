const { EventEmitter } = require('node:events')
const { test } = require('uvu')
const assert = require('uvu/assert')
const { create } = require('../')

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
    bot.on('message', (ctx) => console.log(ctx))
})

test.run()
