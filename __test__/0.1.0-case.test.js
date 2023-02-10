const { suite } = require('uvu')
const assert = require('uvu/assert')
const { addKeyword, createBot, createFlow } = require('../packages/bot/index')
const { setup, clear, delay } = require('../__mocks__/env')

const suiteCase = suite('Flujo: sensitive')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`Responder a "ole" en minuscula`, async ({ database, provider }) => {
    const flow = addKeyword(['ola', 'ole'], { sensitive: true }).addAnswer('Bienvenido a la OLA')

    createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'ole',
    })

    await delay(100)

    assert.is('Bienvenido a la OLA', database.listHistory[0].answer)
    assert.is(undefined, database.listHistory[1])
})

suiteCase(`NO Responder a "ole" en minuscula`, async ({ database, provider }) => {
    const flow = addKeyword(['ola', 'ole'], { sensitive: true }).addAnswer('Bienvenido a la OLA')

    createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'OLE',
    })

    await delay(100)

    assert.is(undefined, database.listHistory[0])
    assert.is(undefined, database.listHistory[1])
})

suiteCase.run()
