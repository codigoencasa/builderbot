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

suiteCase.run()
