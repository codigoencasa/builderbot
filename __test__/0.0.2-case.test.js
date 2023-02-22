const { suite } = require('uvu')
const assert = require('uvu/assert')
const { addKeyword, createBot, createFlow } = require('../packages/bot/index')
const { setup, clear, delay } = require('../__mocks__/env')

const suiteCase = suite('Flujo: manejo de goto')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`Debe saltar de flujo`, async ({ database, provider }) => {
    const flujoUsuarioRegistrado = addKeyword(['user_register'])
        .addAnswer('Hola usuario registrado')
        .addAnswer('como estas usuario registrado')

    // console.log('ARBOL', flujoUsuarioRegistrado.toJson())

    const flujoBienvenida = addKeyword(['hola'])
        .addAnswer('Buenas', null, async (_, { gotoFlow, flowDynamic, endFlow }) => {
            await delay(10)
            await flowDynamic('Usuario registrado DEMO')
            await gotoFlow(flujoUsuarioRegistrado)
        })
        .addAnswer('este mensaje no deberia existir')

    createBot({
        database,
        flow: createFlow([flujoBienvenida]),
        provider,
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await delay(100)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is('Buenas', getHistory[0])
    assert.is('Usuario registrado DEMO', getHistory[1])
    assert.is('Hola usuario registrado', getHistory[2])
    assert.is('como estas usuario registrado', getHistory[3])
    assert.is(undefined, getHistory[4])
})

suiteCase.run()
