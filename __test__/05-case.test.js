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

test(`[Caso - 05] Continuar Flujo (continueFlow)`, async () => {
    const MOCK_VALUES = ['¿CUal es tu email?', 'Continuamos....', '¿Cual es tu edad?']
    const provider = createProvider(PROVIDER_DB)
    const database = new MOCK_DB()

    const flujoPrincipal = addKeyword(['hola'])
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
                return fallBack(validation)
            }
        )
        .addAnswer(MOCK_VALUES[1])
        .addAnswer(MOCK_VALUES[2], { capture: true }, async (ctx, { flowDynamic, fallBack }) => {
            if (ctx.body !== '18') {
                await delay(50)
                return fallBack(false, 'Ups creo que no eres mayor de edad')
            }
            return flowDynamic('Bien tu edad es correcta!')
        })
        .addAnswer('Puedes pasar')

    createBot({
        database,
        flow: createFlow([flujoPrincipal]),
        provider,
    })

    provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    provider.delaySendMessage(10, 'message', {
        from: '000',
        body: 'this is not email value',
    })

    provider.delaySendMessage(20, 'message', {
        from: '000',
        body: 'test@test.com',
    })

    provider.delaySendMessage(90, 'message', {
        from: '000',
        body: '20',
    })

    provider.delaySendMessage(200, 'message', {
        from: '000',
        body: '18',
    })

    await delay(1200)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is(MOCK_VALUES[0], getHistory[0])
    assert.is('this is not email value', getHistory[1])
    assert.is(MOCK_VALUES[0], getHistory[2])
    assert.is('test@test.com', getHistory[3])
    assert.is('1 Gracias por tu email se ha validado de manera correcta', getHistory[4])
    assert.is(MOCK_VALUES[1], getHistory[5])
    assert.is(MOCK_VALUES[2], getHistory[6])
    assert.is('20', getHistory[7])
    assert.is('Ups creo que no eres mayor de edad', getHistory[8])
    assert.is('18', getHistory[9])
    assert.is('Bien tu edad es correcta!', getHistory[10])
    assert.is('Puedes pasar', getHistory[11])
})

test.run()

function delay(ms) {
    return new Promise((res) => setTimeout(res, ms))
}
