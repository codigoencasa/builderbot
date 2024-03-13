import { suite } from 'uvu'
import * as assert from 'uvu/assert'

import { setup, clear, parseAnswers } from '../../__mock__/env'
import { addKeyword, createBot, createFlow } from '../../src'
import { delay } from '../../src/utils'

const fakeHTTP = async (fakeData: string[] = []) => {
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
    const history = parseAnswers(database.listHistory).map((item) => item.answer)
    assert.is(MOCK_VALUES[0], history[0])

    //FlowDynamic
    assert.is('Ford', history[1])
    assert.is('GM', history[2])
    assert.is('BMW', history[3])

    assert.is(MOCK_VALUES[1], history[4])

    //FlowDynamic
    assert.is('Ranger', history[5])
    assert.is('Explorer', history[6])

    assert.is(MOCK_VALUES[2], history[7])

    //FlowDynamic
    assert.is('Usado', history[8])
    assert.is('Nuevos', history[9])

    assert.is(MOCK_VALUES[3], history[10])

    //FlowDynamic
    assert.is('1000', history[11])
    assert.is('2000', history[12])
    assert.is('3000', history[13])
    assert.is(undefined, history[14])
})

suiteCase(`Responder con un "string"`, async ({ database, provider }) => {
    const flow = addKeyword(['hola'])
        .addAnswer('Como vas?', null, async (_, { flowDynamic }) => {
            return flowDynamic('Todo bien!')
        })
        .addAnswer('y vos?')

    await createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await delay(100)
    const history = parseAnswers(database.listHistory).map((item) => item.answer)
    assert.is('Como vas?', history[0])
    assert.is('Todo bien!', history[1])
    assert.is('y vos?', history[2])
    assert.is(undefined, history[3])
})

suiteCase(`Lista array de string`, async ({ database, provider }) => {
    const flow = addKeyword(['hola']).addAnswer('Como vas?', null, async (_, { flowDynamic }) => {
        return flowDynamic(['Todo bien!', 'y vos?'])
    })

    await createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await delay(100)
    const history = parseAnswers(database.listHistory).map((item) => item.answer)
    assert.is('Como vas?', history[0])
    assert.is('Todo bien!', history[1])
    assert.is('y vos?', history[2])
    assert.is(undefined, history[3])
})

suiteCase(`Responder con un "array"`, async ({ database, provider }) => {
    const flow = addKeyword(['hola'])
        .addAnswer('Como vas?', null, async (_, { flowDynamic }) => {
            return flowDynamic([{ body: 'Todo bien!' }, { body: 'trabajando' }])
        })
        .addAnswer('y vos?')

    await createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await delay(100)
    const history = parseAnswers(database.listHistory).map((item) => item.answer)
    assert.is('Como vas?', history[0])
    assert.is('Todo bien!', history[1])
    assert.is('trabajando', history[2])
    assert.is('y vos?', history[3])
    assert.is(undefined, history[4])
})

suiteCase(`Responder con un "object"`, async ({ database, provider }) => {
    const flow = addKeyword(['hola'])
        .addAnswer('Como vas?', null, async (_, { flowDynamic }) => {
            return flowDynamic([{ body: 'Todo bien!' }])
        })
        .addAnswer('y vos?')

    await createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await delay(100)
    const history = parseAnswers(database.listHistory).map((item) => item.answer)
    assert.is('Como vas?', history[0])
    assert.is('Todo bien!', history[1])
    assert.is('y vos?', history[2])
    assert.is(undefined, history[3])
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

    await createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'hola',
    })

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'mal',
    })

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'bien',
    })

    await delay(100)
    const history = parseAnswers(database.listHistory).map((item) => item.answer)
    assert.is('Como vas?: dime "bien" sino entro en fallback', history[0])
    assert.is('mal', history[1])
    assert.is('Como vas?: dime "bien" sino entro en fallback', history[2])
    assert.is('bien', history[3])
    assert.is('Todo bien!', history[4])
    assert.is('fin!', history[5])
    assert.is(undefined, history[6])
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

    await createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'flowDos',
    })

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'flow3',
    })

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'flow4',
    })

    await delay(100)

    const history = parseAnswers(database.listHistory).map((item) => item.answer)
    assert.is('Buenas! escribe flowDos', history[0])
    assert.is('flowDos', history[1])
    assert.is('Vamos al flowDos', history[2])
    assert.is('Soy flujo 2', history[3])
    assert.is('Soy flujo 2-1 escribe flow3', history[4])
    assert.is('flow3', history[5])
    assert.is('Soy flujo 3', history[7])
    assert.is('flow4', history[8])
    assert.is('Soy flujo 4', history[9])
    assert.is('Vamos por mas', history[10])
    assert.is('Soy flujo 4-1', history[11])
    assert.is(undefined, history[12])
})

suiteCase.run()
