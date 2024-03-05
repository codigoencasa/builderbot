import { suite } from 'uvu'
import * as assert from 'uvu/assert'

import { clear, delay, parseAnswers, setup } from '../../__mock__/env'
import { addKeyword, createBot, createFlow } from '../../src'

const suiteCase = suite('Flujo: capture')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`Responder a "pregunta"`, async ({ database, provider }) => {
    const flow = addKeyword(['hola'])
        .addAnswer(['Hola como estas?', '¿Cual es tu edad?'], { capture: true })
        .addAnswer('Gracias por tu respuesta')

    await createBot({
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

    const history = parseAnswers(database.listHistory).map((item) => item.answer)

    assert.is(['Hola como estas?', '¿Cual es tu edad?'].join('\n'), history[0])
    assert.is('90', history[1])
    assert.is('Gracias por tu respuesta', history[2])
    assert.is(undefined, history[3])
})

suiteCase.run()
