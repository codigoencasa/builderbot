const { test } = require('uvu')
const assert = require('uvu/assert')
const MOCK_DB = require('../packages/database/src/mock')
const PROVIDER_DB = require('../packages/provider/src/mock')
const { addKeyword, createBot, createFlow, createProvider } = require('../packages/bot/index')

/**
 * Falsear peticion async
 * @param {*} fakeData
 * @returns
 */
const fakeHTTP = async (fakeData = []) => {
    await delay(5)
    const data = fakeData.map((u, i) => ({ body: `${i + 1} ${u}` }))
    return Promise.resolve(data)
}

let STATE_APP = {}

test(`[Caso - 07] Retornar estado`, async () => {
    const MOCK_VALUES = ['¿Cual es tu nombre?', '¿Cual es tu edad?', 'Tu datos son:']
    const provider = createProvider(PROVIDER_DB)
    const database = new MOCK_DB()

    const flujoPrincipal = addKeyword(['hola'])
        .addAnswer(
            MOCK_VALUES[0],
            {
                capture: true,
            },
            async (ctx, { flowDynamic, fallBack }) => {
                STATE_APP[ctx.from] = { ...STATE_APP[ctx.from], name: ctx.body }

                flowDynamic('Gracias por tu nombre!')
            }
        )
        .addAnswer(
            MOCK_VALUES[1],
            {
                capture: true,
            },
            async (ctx, { flowDynamic, endFlow }) => {
                STATE_APP[ctx.from] = { ...STATE_APP[ctx.from], age: ctx.body }

                await flowDynamic('Gracias por tu edad!')
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

    provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    provider.delaySendMessage(20, 'message', {
        from: '000',
        body: 'Leifer',
    })

    provider.delaySendMessage(40, 'message', {
        from: '000',
        body: '90',
    })

    await delay(1200)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is(MOCK_VALUES[0], getHistory[0])
    assert.is('Leifer', getHistory[1])
    assert.is('Gracias por tu nombre!', getHistory[2])
    assert.is('¿Cual es tu edad?', getHistory[3])
    assert.is('90', getHistory[4])
    assert.is('Gracias por tu edad!', getHistory[5])
    assert.is('Tu datos son:', getHistory[6])
    assert.is('Nombre: Leifer Edad: 90', getHistory[7])
    assert.is('🤖🤖 Gracias por tu participacion', getHistory[8])
    assert.is(undefined, getHistory[9])
})

test.run()

function delay(ms) {
    return new Promise((res) => setTimeout(res, ms))
}
