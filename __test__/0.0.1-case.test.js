const { suite } = require('uvu')
const assert = require('uvu/assert')
const { addKeyword, createBot, createFlow, EVENTS } = require('../packages/bot/index')
const { setup, clear, delay } = require('../__mocks__/env')

const suiteCase = suite('Flujo: Provider envia un location')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`Responder a "EVENTS.LOCATION"`, async ({ database, provider }) => {
    const flow = addKeyword(EVENTS.LOCATION).addAnswer('Gracias por tu location')

    createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: '_event_location__f405d946-cf07-uutt-l7e0-b6d475bc7f81',
    })

    await delay(200)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is('Gracias por tu location', getHistory[0])
    assert.is(undefined, getHistory[1])
})

suiteCase.run()
