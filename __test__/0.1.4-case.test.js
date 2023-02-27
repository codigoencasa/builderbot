const { suite } = require('uvu')
const assert = require('uvu/assert')
const { addKeyword, createBot, createFlow } = require('../packages/bot/index')
const { setup, clear, delay } = require('../__mocks__/env')

const fakeHTTP = async (fakeData = []) => {
    await delay(50)
    const data = fakeData.map((u) => ({ body: `${u}` }))
    return Promise.resolve(data)
}

const suiteCase = suite('Flujo: flowDynamic')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`Responder con mensajes asyncronos`, async ({ database, provider }) => {
    const MOCK_VALUES = [
        'Bienvenido te envio muchas marcas (5510)',
        'Seleccione marca del auto a cotizar, con el *número* correspondiente',
        'Seleccione la sub marca del auto a cotizar, con el *número* correspondiente:',
        'Los precios rondan:',
    ]
    const flow = addKeyword(['hola'])
        .addAnswer(MOCK_VALUES[0], null, async (_, { flowDynamic }) => {
            const data = await fakeHTTP(['Ford', 'GM', 'BMW'])
            return flowDynamic(data)
        })
        .addAnswer(MOCK_VALUES[1], null, async (_, { flowDynamic }) => {
            const data = await fakeHTTP(['Ranger', 'Explorer'])
            return flowDynamic(data)
        })
        .addAnswer(MOCK_VALUES[2], null, async (_, { flowDynamic }) => {
            const data = await fakeHTTP(['Usado', 'Nuevos'])
            return flowDynamic(data)
        })
        .addAnswer(MOCK_VALUES[3], null, async (_, { flowDynamic }) => {
            const data = await fakeHTTP(['1000', '2000', '3000'])
            return flowDynamic(data)
        })

    createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await delay(1500)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is(MOCK_VALUES[0], getHistory[0])

    //FlowDynamic
    assert.is('Ford', getHistory[1])
    assert.is('GM', getHistory[2])
    assert.is('BMW', getHistory[3])

    assert.is(MOCK_VALUES[1], getHistory[4])

    //FlowDynamic
    assert.is('Ranger', getHistory[5])
    assert.is('Explorer', getHistory[6])

    assert.is(MOCK_VALUES[2], getHistory[7])

    //FlowDynamic
    assert.is('Usado', getHistory[8])
    assert.is('Nuevos', getHistory[9])

    assert.is(MOCK_VALUES[3], getHistory[10])

    //FlowDynamic
    assert.is('1000', getHistory[11])
    assert.is('2000', getHistory[12])
    assert.is('3000', getHistory[13])
    assert.is(undefined, getHistory[14])
})

suiteCase(`Responder con un "string"`, async ({ database, provider }) => {
    const flow = addKeyword(['hola'])
        .addAnswer('Como vas?', null, async (_, { flowDynamic }) => {
            return flowDynamic('Todo bien!')
        })
        .addAnswer('y vos?')

    createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await delay(100)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is('Como vas?', getHistory[0])
    assert.is('Todo bien!', getHistory[1])
    assert.is('y vos?', getHistory[2])
    assert.is(undefined, getHistory[3])
})

suiteCase(`Responder con un "array"`, async ({ database, provider }) => {
    const flow = addKeyword(['hola'])
        .addAnswer('Como vas?', null, async (_, { flowDynamic }) => {
            return flowDynamic(['Todo bien!', 'trabajando'])
        })
        .addAnswer('y vos?')

    createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await delay(100)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is('Como vas?', getHistory[0])
    assert.is('Todo bien!', getHistory[1])
    assert.is('trabajando', getHistory[2])
    assert.is('y vos?', getHistory[3])
    assert.is(undefined, getHistory[4])
})

suiteCase(`Responder con un "object"`, async ({ database, provider }) => {
    const flow = addKeyword(['hola'])
        .addAnswer('Como vas?', null, async (_, { flowDynamic }) => {
            return flowDynamic([{ body: 'Todo bien!' }])
        })
        .addAnswer('y vos?')

    createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await delay(100)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is('Como vas?', getHistory[0])
    assert.is('Todo bien!', getHistory[1])
    assert.is('y vos?', getHistory[2])
    assert.is(undefined, getHistory[3])
})

suiteCase(`FlowDynamic con capture`, async ({ database, provider }) => {
    const flow = addKeyword(['hola'])
        .addAnswer(
            'Como vas?: dime "bien" sino entro en fallback',
            { capture: true },
            async (ctx, { flowDynamic, fallBack }) => {
                if (ctx.body !== 'bien') return fallBack()
                return flowDynamic([{ body: 'Todo bien!' }])
            }
        )
        .addAnswer('fin!')

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
        body: 'mal',
    })

    await provider.delaySendMessage(20, 'message', {
        from: '000',
        body: 'bien',
    })

    await delay(100)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is('Como vas?: dime "bien" sino entro en fallback', getHistory[0])
    assert.is('mal', getHistory[1])
    assert.is('Como vas?: dime "bien" sino entro en fallback', getHistory[2])
    assert.is('bien', getHistory[3])
    assert.is('Todo bien!', getHistory[4])
    assert.is('fin!', getHistory[5])
    assert.is(undefined, getHistory[6])
})

suiteCase(`FlowDynamic con capture en hijo`, async ({ database, provider }) => {
    const flowCuatro = addKeyword('flow4')
        .addAnswer('Soy flujo 4', null, async (_, { flowDynamic }) => {
            await flowDynamic('Vamos por mas')
        })
        .addAnswer('Soy flujo 4-1')

    const flowTres = addKeyword('flow3').addAnswer('Soy flujo 3', { capture: true }, null, [flowCuatro])

    const flowDos = addKeyword('flowDos')
        .addAnswer('Soy flujo 2')
        .addAnswer(
            'Soy flujo 2-1 escribe flow3',
            { capture: true },
            async (_, { flowDynamic }) => {
                await flowDynamic('Vamos al flow3')
            },
            [flowTres]
        )

    const flow = addKeyword(['hola']).addAnswer(
        'Buenas! escribe flowDos',
        { capture: true },
        async (_, { flowDynamic }) => {
            return flowDynamic('Vamos al flowDos')
        },
        [flowDos]
    )

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
        body: 'flowDos',
    })

    await provider.delaySendMessage(20, 'message', {
        from: '000',
        body: 'flow3',
    })

    await provider.delaySendMessage(30, 'message', {
        from: '000',
        body: 'flow4',
    })

    await delay(100)

    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is('Buenas! escribe flowDos', getHistory[0])
    assert.is('flowDos', getHistory[1])
    assert.is('Vamos al flowDos', getHistory[2])
    assert.is('Soy flujo 2', getHistory[3])
    assert.is('Soy flujo 2-1 escribe flow3', getHistory[4])
    assert.is('flow3', getHistory[5])
    assert.is('Soy flujo 3', getHistory[7])
    assert.is('flow4', getHistory[8])
    assert.is('Soy flujo 4', getHistory[9])
    assert.is('Vamos por mas', getHistory[10])
    assert.is('Soy flujo 4-1', getHistory[11])
    // assert.is(undefined, getHistory[7])
})

suiteCase.run()
