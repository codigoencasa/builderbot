const { suite } = require('uvu')
const assert = require('uvu/assert')
const { addKeyword, createBot, createFlow } = require('../packages/bot/index')
const { setup, clear, delay } = require('../__mocks__/env')

const suiteCase = suite('Flujo: Simple')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`Responder a "hola"`, async ({ database, provider }) => {
    const flow = addKeyword('hola').addAnswer('Buenas!').addAnswer('Como vamos!')

    await createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await delay(50)
    assert.is('Buenas!', database.listHistory[0].answer)
    assert.is('Como vamos!', database.listHistory[1].answer)
    assert.is(undefined, database.listHistory[2])
})

suiteCase(`NO reponder a "pepe"`, async ({ database, provider }) => {
    const flow = addKeyword('hola').addAnswer('Buenas!').addAnswer('Como vamos!')

    createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'pepe',
    })

    await delay(1000)

    assert.is(undefined, database.listHistory[0])
    assert.is(undefined, database.listHistory[1])
})

suiteCase.run()
