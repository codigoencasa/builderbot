const { suite } = require('uvu')
const assert = require('uvu/assert')
const { addKeyword, createBot, createFlow } = require('../packages/bot/index')
const { setup, clear, delay } = require('../__mocks__/env')

const suiteCase = suite('Flujo: capture')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`Responder a "pregunta"`, async ({ database, provider }) => {
    const flow = addKeyword(['hola'])
        .addAnswer(['Hola como estas?', '¿Cual es tu edad?'], { capture: true })
        .addAnswer('Gracias por tu respuesta')

    createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await provider.delaySendMessage(10, 'message', {
        from: '000',
        body: '90',
    })

    await delay(100)

    assert.is(['Hola como estas?', '¿Cual es tu edad?'].join('\n'), database.listHistory[0].answer)
    assert.is('90', database.listHistory[1].answer)
    assert.is('Gracias por tu respuesta', database.listHistory[2].answer)
    assert.is(undefined, database.listHistory[3])
})

suiteCase.run()
