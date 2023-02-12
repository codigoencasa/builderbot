const { suite } = require('uvu')
const assert = require('uvu/assert')
const { addKeyword, createBot, createFlow } = require('../packages/bot/index')
const { setup, clear, delay } = require('../__mocks__/env')

const suiteCase = suite('Flujo: Provider envia un location')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`Responder a "CURRENT_LOCATION"`, async ({ database, provider }) => {
    const flow = addKeyword('#CURRENT_LOCATION#').addAnswer('Gracias por tu location')

    createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: '#CURRENT_LOCATION#',
    })

    await delay(200)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is('Gracias por tu location', getHistory[0])
    assert.is(undefined, getHistory[1])
})

suiteCase.run()
