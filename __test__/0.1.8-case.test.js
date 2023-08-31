const { suite } = require('uvu')
const assert = require('uvu/assert')
const { addKeyword, createBot, createFlow } = require('../packages/bot/index')
const { setup, clear, delay } = require('../__mocks__/env')

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
    assert.is('Buenas! ¿Cual es tu nombre?', getHistory[0])
    assert.is('Gracias por tu nombre!: Leifer', getHistory[3])
    assert.is('Chao!', getHistory[4])
    assert.is(undefined, getHistory[5])
})

suiteCase.run()
