import { suite } from 'uvu'
import * as assert from 'uvu/assert'

import { setup, clear, parseAnswers } from '../../__mock__/env'
import { addKeyword, createBot, createFlow } from '../../src'
import { delay } from '../../src/utils'

const suiteCase = suite('Flujo: addAction (capture)')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`Debe ejecutar accion con captura`, async ({ database, provider }) => {
    const flujoPrincipal = addKeyword(['hola'])
        .addAction(async (_, { flowDynamic }) => {
            return flowDynamic('Buenas! ¿Cual es tu nombre?')
        })
        .addAction({ capture: true }, async (ctx, { flowDynamic, state }) => {
            state.update({ name: ctx.body })
            return flowDynamic(`Gracias por tu nombre!: ${ctx.body}`)
        })
        .addAnswer('Chao!')

    await createBot({
        database,
        flow: createFlow([flujoPrincipal]),
        provider,
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await provider.delaySendMessage(50, 'message', {
        from: '000',
        body: 'Leifer',
    })

    await delay(1000)
    const history = parseAnswers(database.listHistory).map((item) => item.answer)
    assert.is('Buenas! ¿Cual es tu nombre?', history[0])
    assert.is('Leifer', history[1])
    assert.is('Gracias por tu nombre!: Leifer', history[2])
    assert.is('Chao!', history[3])
    assert.is(undefined, history[4])
})

suiteCase.run()
