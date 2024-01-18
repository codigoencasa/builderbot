import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import { setup, clear } from '../../_mock_/env'
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
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is('__call_action__', getHistory[0])
    assert.is('Buenas! ¿Cual es tu nombre?', getHistory[1])
    assert.is('__capture_only_intended__', getHistory[2])
    assert.is('Leifer', getHistory[3])
    assert.is('Gracias por tu nombre!: Leifer', getHistory[4])
    assert.is('Chao!', getHistory[5])
    assert.is(undefined, getHistory[6])
})

suiteCase.run()
