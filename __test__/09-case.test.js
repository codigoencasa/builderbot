const { test } = require('uvu')
const assert = require('uvu/assert')
const MOCK_DB = require('../packages/database/src/mock')
const PROVIDER_MOCK = require('../packages/provider/src/mock')
const { addKeyword, createBot, createFlow, createProvider } = require('../packages/bot/index')

let PROVIDER = undefined

test(`[Caso - 09] Check provider WS`, async () => {
    const [VALUE_A, VALUE_B] = ['hola', 'buenas']

    const flow = addKeyword(VALUE_A).addAnswer(VALUE_B, null, async (_, { provider }) => {
        PROVIDER = provider
    })
    const provider = createProvider(PROVIDER_MOCK)
    const database = new MOCK_DB()

    createBot({
        database,
        flow: createFlow([flow]),
        provider,
    })

    provider.delaySendMessage(100, 'message', {
        from: '000',
        body: VALUE_A,
    })

    await delay(100)

    const prevMsg = database.getPrevByNumber('000')

    assert.is(prevMsg.answer, VALUE_B)
    assert.is(typeof PROVIDER.sendMessage, 'function')
})

test.run()

function delay(ms) {
    return new Promise((res) => setTimeout(res, ms))
}
