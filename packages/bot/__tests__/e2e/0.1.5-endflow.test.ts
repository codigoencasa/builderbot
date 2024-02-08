import { suite } from 'uvu'
import * as assert from 'uvu/assert'

import { setup, clear } from '../../__mock__/env'
import { addKeyword, createBot, createFlow, EVENTS } from '../../src'
import { delay } from '../../src/utils'

const fakeHTTP = async (fakeData: string[] = []) => {
    await delay(50)
    const data = fakeData.map((u) => ({ body: `${u}` }))
    return Promise.resolve(data)
}

const suiteCase = suite('Flujo: endFlow')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`Detener el flujo`, async ({ database, provider }) => {
    const MOCK_VALUES = [
        'Bienvenido te envio muchas marcas',
        'Seleccione marca del auto a cotizar, con el *número* correspondiente',
        'Seleccione la sub marca del auto a cotizar, con el *número* correspondiente:',
        'Los precios rondan:',
    ]
    const flow = addKeyword(['hola'])
        .addAnswer(MOCK_VALUES[0], null, async (_, { flowDynamic }) => {
            const data = await fakeHTTP(['Ford', 'GM', 'BMW'])
            return flowDynamic(data)
        })
        .addAnswer(MOCK_VALUES[1], null, async (_, { endFlow }) => {
            return endFlow()
        })
        .addAnswer(MOCK_VALUES[2])
        .addAnswer(MOCK_VALUES[3], null, async (_, { flowDynamic }) => {
            const data = await fakeHTTP(['1000', '2000', '3000'])
            return flowDynamic(data)
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

    await delay(900)
    const getHistory = database.listHistory.map((i: { answer: any }) => i.answer)
    assert.is(MOCK_VALUES[0], getHistory[0])

    //FlowDynamic
    assert.is('Ford', getHistory[1])
    assert.is('GM', getHistory[2])
    assert.is('BMW', getHistory[3])

    assert.is(MOCK_VALUES[1], getHistory[4])

    //FlowDynamic
    assert.is(undefined, getHistory[5])
    assert.is(undefined, getHistory[6])
})

suiteCase(`Detener el flujo flowDynamic`, async ({ database, provider }) => {
    const flow = addKeyword(['hola'])
        .addAnswer('Buenas!', null, async (_, { endFlow, flowDynamic }) => {
            await flowDynamic('Continuamos...')
            return endFlow()
        })
        .addAnswer('Como estas!')

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
    const getHistory = database.listHistory.map((i: { answer: any }) => i.answer)
    assert.is('Buenas!', getHistory[0])
    assert.is('Continuamos...', getHistory[1])
    assert.is(undefined, getHistory[2])
})

suiteCase(`flowDynamic con capture`, async ({ database, provider }) => {
    const MOCK_VALUES = ['¿CUal es tu email?', 'Continuamos....', '¿Cual es tu edad?']

    const flow = addKeyword(['hola'])
        .addAnswer(
            MOCK_VALUES[0],
            {
                capture: true,
            },
            async (ctx, { flowDynamic, fallBack }) => {
                const validation = ctx.body.includes('@')

                if (validation) {
                    const getDataFromApi = await fakeHTTP(['Gracias por tu email se ha validado de manera correcta'])
                    return flowDynamic(getDataFromApi)
                }
                return fallBack()
            }
        )
        .addAnswer(MOCK_VALUES[1])
        .addAnswer(MOCK_VALUES[2], { capture: true }, async (ctx, { flowDynamic, fallBack }) => {
            if (ctx.body !== '18') {
                await delay(20)
                return fallBack('Ups creo que no eres mayor de edad')
            }
            return flowDynamic('Bien tu edad es correcta!')
        })
        .addAnswer('Puedes pasar')

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
        body: 'this is not email value',
    })

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'test@test.com',
    })

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: '20',
    })

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: '18',
    })

    await delay(900)
    const getHistory = database.listHistory.map((i: { answer: any }) => i.answer)
    assert.is(MOCK_VALUES[0], getHistory[0])
    assert.is('this is not email value', getHistory[1])
    assert.is(MOCK_VALUES[0], getHistory[2])
    assert.is('test@test.com', getHistory[3])
    assert.is('Gracias por tu email se ha validado de manera correcta', getHistory[4])
    assert.is(MOCK_VALUES[1], getHistory[5])
    assert.is(MOCK_VALUES[2], getHistory[6])
    assert.is('20', getHistory[7]) //TODO:Este punto falla en los test
    assert.is('Ups creo que no eres mayor de edad', getHistory[8])
    assert.is('18', getHistory[9])
    assert.is('Bien tu edad es correcta!', getHistory[10])
    assert.is('Puedes pasar', getHistory[11])
})

suiteCase(`endFlow desde gotoFlow`, async ({ database, provider }) => {
    const flow = addKeyword(['hola'])
        .addAnswer('Buenas!', null, async (_, { gotoFlow }) => {
            return gotoFlow(flowUsuario)
        })
        .addAnswer('no debe llegar')

    const errorFlow = addKeyword(EVENTS.ACTION).addAnswer('error')

    const flowUsuario = addKeyword(EVENTS.ACTION)
        .addAction({ ref: `1111111111111111` }, async (_, { flowDynamic, endFlow, gotoFlow }) => {
            try {
                const confirmar = {
                    data: {
                        estado: '3',
                    },
                } as any
                if (confirmar === 500) {
                    return gotoFlow(errorFlow)
                }
                if (confirmar.data.estado === '3') {
                    return endFlow(`Final y no mas`)
                }

                if (confirmar.data) {
                    await flowDynamic('ya estas! debe finalizar flow no debe enviar mas mensajes')
                    return endFlow()
                }
            } catch (error) {
                console.error(error)
            }
            await flowDynamic('⏳ por favor solo espere a que el asistente responda 🍀🤖...')
        })
        .addAction({ ref: `22222222222` }, async (_, { flowDynamic }) => {
            await flowDynamic('ping pong')
            console.log(`🌟🌟🌟🌟`)
        })

    await createBot({
        database,
        provider,
        flow: createFlow([flow, flowUsuario]),
    })

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'hola',
    })

    await delay(5000)
    const getHistory = database.listHistory.map((i: { answer: any }) => i.answer)
    assert.is('Buenas!', getHistory[0])
    assert.is('__capture_only_intended__', getHistory[1])
    assert.is('__capture_only_intended__', getHistory[2])
    assert.is('Final y no mas', getHistory[3])
    assert.is(undefined, getHistory[4])
    // assert.is('this is not email value', getHistory[1])
    // assert.is(MOCK_VALUES[0], getHistory[2])
    // assert.is('test@test.com', getHistory[3])
    // assert.is('Gracias por tu email se ha validado de manera correcta', getHistory[4])
    // assert.is(MOCK_VALUES[1], getHistory[5])
    // assert.is(MOCK_VALUES[2], getHistory[6])
    // assert.is('20', getHistory[7])
    // assert.is('Ups creo que no eres mayor de edad', getHistory[8])
    // assert.is('18', getHistory[9])
    // assert.is('Bien tu edad es correcta!', getHistory[10])
    // assert.is('Puedes pasar', getHistory[11])
})

suiteCase.run()
