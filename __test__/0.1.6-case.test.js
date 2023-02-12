const { suite } = require('uvu')
const assert = require('uvu/assert')
const { addKeyword, createBot, createFlow } = require('../packages/bot/index')
const { setup, clear, delay } = require('../__mocks__/env')

const suiteCase = suite('Flujo: manejo de estado')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`Debe retornar un mensaje resumen`, async ({ database, provider }) => {
    let STATE_APP = {}
    const MOCK_VALUES = ['¿Cual es tu nombre?', '¿Cual es tu edad?', 'Tu datos son:']

    const flujoPrincipal = addKeyword(['hola'])
        .addAnswer(
            MOCK_VALUES[0],
            {
                capture: true,
            },
            async (ctx, { flowDynamic }) => {
                STATE_APP[ctx.from] = { ...STATE_APP[ctx.from], name: ctx.body }

                flowDynamic('Gracias por tu nombre!')
            }
        )
        .addAnswer(
            MOCK_VALUES[1],
            {
                capture: true,
            },
            async (ctx, { flowDynamic }) => {
                STATE_APP[ctx.from] = { ...STATE_APP[ctx.from], age: ctx.body }

                await flowDynamic(`Gracias por tu edad! ${STATE_APP[ctx.from].name}`)
            }
        )
        .addAnswer(MOCK_VALUES[2], null, async (ctx, { flowDynamic }) => {
            flowDynamic(`Nombre: ${STATE_APP[ctx.from].name} Edad: ${STATE_APP[ctx.from].age}`)
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

    await provider.delaySendMessage(5, 'message', {
        from: '001',
        body: 'hola',
    })

    await provider.delaySendMessage(10, 'message', {
        from: '000',
        body: 'Leifer',
    })

    await provider.delaySendMessage(15, 'message', {
        from: '000',
        body: '90',
    })

    await provider.delaySendMessage(20, 'message', {
        from: '001',
        body: 'Maria',
    })

    await provider.delaySendMessage(25, 'message', {
        from: '001',
        body: '100',
    })

    await delay(1000)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is(MOCK_VALUES[0], getHistory[0])
    assert.is('¿Cual es tu nombre?', getHistory[1])
    assert.is('Leifer', getHistory[2])
    assert.is('Gracias por tu nombre!', getHistory[3])
    assert.is('¿Cual es tu edad?', getHistory[4])
    assert.is('90', getHistory[5])
    assert.is('Gracias por tu edad! Leifer', getHistory[6])
    assert.is('Tu datos son:', getHistory[7])
    assert.is('Nombre: Leifer Edad: 90', getHistory[8])
    assert.is('🤖🤖 Gracias por tu participacion', getHistory[9])
    assert.is('Maria', getHistory[10])
    assert.is('Gracias por tu nombre!', getHistory[11])
    assert.is('100', getHistory[12])
    assert.is(undefined, getHistory[13])
})

suiteCase.run()
