const { suite } = require('uvu')
const assert = require('uvu/assert')
const { addKeyword, createBot, createFlow } = require('../packages/bot/index')
const { setup, clear, delay } = require('../__mocks__/env')

const suiteCase = suite('Flujo: manejo de estado')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`Debe retornar un mensaje resumen`, async ({ database, provider }) => {
    const MOCK_VALUES = ['¿Cual es tu nombre?', '¿Cual es tu edad?', 'Tu datos son:']

    const flujoPrincipal = addKeyword(['hola'])
        .addAnswer(
            MOCK_VALUES[0],
            {
                capture: true,
            },
            async (ctx, { flowDynamic, state }) => {
                state.update({ name: ctx.body })
                flowDynamic('Gracias por tu nombre!')
            }
        )
        .addAnswer(
            MOCK_VALUES[1],
            {
                capture: true,
            },
            async (ctx, { flowDynamic, state }) => {
                state.update({ age: ctx.body })
                const myState = state.getMyState()
                await flowDynamic(`Gracias por tu edad! ${myState.name}`)
            }
        )
        .addAnswer(MOCK_VALUES[2], null, async (_, { flowDynamic, state }) => {
            const myState = state.getMyState()
            flowDynamic(`Nombre: ${myState.name} Edad: ${myState.age}`)
        })
        .addAnswer('🤖🤖 Gracias por tu participacion')

    createBot({
        database,
        flow: createFlow([flujoPrincipal]),
        provider,
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await provider.delaySendMessage(100, 'message', {
        from: '001',
        body: 'hola',
    })

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'Leifer',
    })

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: '90',
    })

    await provider.delaySendMessage(100, 'message', {
        from: '001',
        body: 'Maria',
    })

    await provider.delaySendMessage(100, 'message', {
        from: '001',
        body: '100',
    })

    await delay(500)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is(true, getHistory.includes('Nombre: Leifer Edad: 90'))
    assert.is(true, getHistory.includes('Nombre: Maria Edad: 100'))

    // assert.is('100', getHistory[12])
    // assert.is(undefined, getHistory[13])
})

suiteCase.run()

// ++[
// ++··"¿Cual·es·tu·nombre?",
// ++··"¿Cual·es·tu·nombre?",
// ++··"Leifer",
// ++··"Gracias·por·tu·nombre!",
// ++··"¿Cual·es·tu·edad?",
// ++··"90",
// ++··"Gracias·por·tu·edad!·Leifer",
// ++··"Tu·datos·son:",
// ++··"Nombre:·Leifer·Edad:·90",
// ++··"🤖🤖·Gracias·por·tu·participacion",
// ++··"Tu·datos·son:",
// ++··"Nombre:·Leifer·Edad:·90",
// ++··"Maria",
// ++··"Gracias·por·tu·nombre!",
// ++··"¿Cual·es·tu·edad?",
// ++··"100",
// ++··"Gracias·por·tu·edad!·Maria",
// ++··"Tu·datos·son:",
// ++··"Nombre:·Maria·Edad:·100",
// ++··"🤖🤖·Gracias·por·tu·participacion",
// ++··"Tu·datos·son:",
// ++··"Nombre:·Maria·Edad:·100"
// ++]
