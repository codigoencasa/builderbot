const { suite } = require('uvu')
const assert = require('uvu/assert')
const { addKeyword, createBot, createFlow } = require('../packages/bot/index')
const { setup, clear, delay } = require('../__mocks__/env')

const testSuite = suite('Flujo: sensitive')

testSuite.before.each(setup)
testSuite.after.each(clear)

testSuite(`Responder a "ole" en minúscula`, async ({ database, provider }) => {
    const sensitiveFlow = addKeyword(['ola', 'ole'], { sensitive: true }).addAnswer('Bienvenido a la OLA')

    await createBot({
        database,
        provider,
        flow: createFlow([sensitiveFlow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'ole',
    })

    await delay(100)

    assert.is('Bienvenido a la OLA', database.listHistory[0].answer)
    assert.is(undefined, database.listHistory[1])
})

testSuite(`NO Responder a "OLE" en mayúscula`, async ({ database, provider }) => {
    const sensitiveFlow = addKeyword(['ola', 'ole'], { sensitive: true }).addAnswer('Bienvenido a la OLA')

    await createBot({
        database,
        provider,
        flow: createFlow([sensitiveFlow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'OLE',
    })

    await delay(100)

    assert.is(undefined, database.listHistory[0])
    assert.is(undefined, database.listHistory[1])
})

testSuite.run()
