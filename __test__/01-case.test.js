const { test } = require('uvu')
const assert = require('uvu/assert')
const MOCK_DB = require('../packages/database/src/mock')
const PROVIDER_DB = require('../packages/provider/src/mock')
const { addKeyword, createBot, createFlow, createProvider } = require('../packages/bot/index')

test(`[Caso - 01] Flow Basico`, async () => {
    const [VALUE_A, VALUE_B] = ['hola', 'buenas']

    const flow = addKeyword(VALUE_A).addAnswer(VALUE_B)
    const provider = createProvider(PROVIDER_DB)
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
})

test.run()

function delay(ms) {
    return new Promise((res) => setTimeout(res, ms))
}
