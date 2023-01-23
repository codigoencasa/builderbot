const { test } = require('uvu')
const assert = require('uvu/assert')
const MOCK_DB = require('../packages/database/src/mock')
const PROVIDER_DB = require('../packages/provider/src/mock')
const {
    addKeyword,
    createBot,
    createFlow,
    createProvider,
} = require('../packages/bot/index')

test(`[Caso - 03] Flow puro`, async () => {
    const MOCK_VALUES = ['Bienvenido a mi tienda', 'Como estas?']

    const provider = createProvider(PROVIDER_DB)
    const database = new MOCK_DB()

    const flujoPrincipal = addKeyword(['hola'])
        .addAnswer(MOCK_VALUES[0])
        .addAnswer(MOCK_VALUES[1])

    createBot({
        database,
        flow: createFlow([flujoPrincipal]),
        provider,
    })

    provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await delay(10)
    const getHistory = database.listHistory.map((i) => i.answer)

    assert.is(MOCK_VALUES[0], getHistory[0])
    assert.is(MOCK_VALUES[1], getHistory[1])
})

test.run()

function delay(ms) {
    return new Promise((res) => setTimeout(res, ms))
}
