const { test } = require('uvu')
const assert = require('uvu/assert')
const MOCK_DB = require('../packages/database/src/mock')
const PROVIDER_DB = require('../packages/provider/src/mock')
const {
    addKeyword,
    createBot,
    createFlow,
    createProvider,
} = require('../packages/bot/index')

/**
 * Falsear peticion async
 * @param {*} fakeData
 * @returns
 */
const fakeHTTP = async (fakeData = []) => {
    console.log('⚡ Server request!')
    await delay(50)
    console.log('⚡ Server return!')
    const data = fakeData.map((u, i) => ({ body: `${i + 1} ${u}` }))
    console.log(data)
    return Promise.resolve(data)
}

test(`[Caso - 02] Flow (flowDynamic)`, async () => {
    const MOCK_VALUES = [
        'Bienvenido te envio muchas marcas (5510)',
        'Seleccione marca del auto a cotizar, con el *número* correspondiente',
        'Seleccione la sub marca del auto a cotizar, con el *número* correspondiente:',
        'Los precios rondan:',
    ]
    const provider = createProvider(PROVIDER_DB)
    const database = new MOCK_DB()

    const flujoPrincipal = addKeyword(['hola'])
        .addAnswer(MOCK_VALUES[0], null, async (ctx, { flowDynamic }) => {
            console.log('execute...')
            const data = await fakeHTTP(['Ford', 'GM', 'BMW'])
            return flowDynamic(data)
        })
        .addAnswer(MOCK_VALUES[1], null, async (ctx, { flowDynamic }) => {
            const data = await fakeHTTP(['Ranger', 'Explorer'])
            return flowDynamic(data)
        })
        .addAnswer(MOCK_VALUES[2], null, async (ctx, { flowDynamic }) => {
            const data = await fakeHTTP(['Usado', 'Nuevos'])
            return flowDynamic(data)
        })
        .addAnswer(MOCK_VALUES[3], null, async (ctx, { flowDynamic }) => {
            const data = await fakeHTTP(['1000', '2000', '3000'])
            return flowDynamic(data)
        })

    createBot({
        database,
        flow: createFlow([flujoPrincipal]),
        provider,
    })

    provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await delay(1200)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is(MOCK_VALUES[0], getHistory[0])

    //FlowDynamic
    assert.is('1 Ford', getHistory[1])
    assert.is('2 GM', getHistory[2])
    assert.is('3 BMW', getHistory[3])

    assert.is(MOCK_VALUES[1], getHistory[4])

    //FlowDynamic
    assert.is('1 Ranger', getHistory[5])
    assert.is('2 Explorer', getHistory[6])

    assert.is(MOCK_VALUES[2], getHistory[7])

    //FlowDynamic
    assert.is('1 Usado', getHistory[8])
    assert.is('2 Nuevos', getHistory[9])

    assert.is(MOCK_VALUES[3], getHistory[10])

    //FlowDynamic
    assert.is('1 1000', getHistory[11])
    assert.is('2 2000', getHistory[12])
    assert.is('3 3000', getHistory[13])
})

test.run()

function delay(ms) {
    return new Promise((res) => setTimeout(res, ms))
}
