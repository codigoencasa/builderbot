const { suite } = require('uvu')
const assert = require('uvu/assert')
const { addKeyword, createBot, createFlow } = require('../packages/bot/index')
const { setup, clear, delay } = require('../__mocks__/env')

const testSuite = suite('Flujo: manejo de goto')

testSuite.before.each(setup)
testSuite.after.each(clear)

testSuite(`Debe saltar de flujo siguiente`, async ({ database, provider }) => {
    const userRegisteredFlow = addKeyword(['user_register'])
        .addAnswer('Hola usuario registrado')
        .addAnswer('como estas usuario registrado')

    const welcomeFlow = addKeyword(['hola'])
        .addAnswer('Buenas', null, async (_, { gotoFlow, flowDynamic }) => {
            await delay(10)
            await flowDynamic('Usuario registrado DEMO')
            await gotoFlow(userRegisteredFlow)
        })
        .addAnswer('este mensaje no debería existir')

    await createBot({
        database,
        flow: createFlow([welcomeFlow]),
        provider,
    })

    await provider.delaySendMessage(50, 'message', {
        from: '000',
        body: 'hola',
    })

    await delay(100)
    const history = database.listHistory.map((item) => item.answer)
    assert.is('Buenas', history[0])
    assert.is('Usuario registrado DEMO', history[1])
    assert.is('Hola usuario registrado', history[2])
    assert.is('como estas usuario registrado', history[3])
    assert.is(undefined, history[4])
})

testSuite(`Debe saltar de flujo con capture sin flowDynamic`, async ({ database, provider }) => {
    const userRegisteredFlow = addKeyword(['user_register'])
        .addAnswer('Hola usuario registrado')
        .addAnswer('como estas usuario registrado')

    const welcomeFlow = addKeyword(['hola'])
        .addAnswer('Buenas', { capture: true }, async (_, { gotoFlow }) => {
            await gotoFlow(userRegisteredFlow)
        })
        .addAnswer('este mensaje no debería existir')

    await createBot({
        database,
        flow: createFlow([welcomeFlow]),
        provider,
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await provider.delaySendMessage(10, 'message', {
        from: '000',
        body: 'ping',
    })

    await delay(50)
    const history = database.listHistory.map((item) => item.answer)
    assert.is('Buenas', history[0])
    assert.is('ping', history[1])
    assert.is('Hola usuario registrado', history[2])
    assert.is('como estas usuario registrado', history[3])
    assert.is(undefined, history[4])
})

testSuite(`Debe saltar de flujo con capture con flowDynamic`, async ({ database, provider }) => {
    const userRegisteredFlow = addKeyword(['user_register'])
        .addAnswer('Hola usuario registrado')
        .addAnswer('como estas usuario registrado')

    const welcomeFlow = addKeyword(['hola'])
        .addAnswer('Buenas', { capture: true }, async (_, { gotoFlow, flowDynamic }) => {
            await delay(10)
            await flowDynamic('Usuario registrado DEMO', { continue: false })
            await gotoFlow(userRegisteredFlow)
        })
        .addAnswer('este mensaje no debería existir')

    await createBot({
        database,
        flow: createFlow([welcomeFlow]),
        provider,
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await provider.delaySendMessage(10, 'message', {
        from: '000',
        body: 'ping',
    })

    await delay(50)
    const history = database.listHistory.map((item) => item.answer)
    assert.is('Buenas', history[0])
    assert.is('ping', history[1])
    assert.is('Usuario registrado DEMO', history[2])
    assert.is('Hola usuario registrado', history[3])
    assert.is('como estas usuario registrado', history[4])
    assert.is(undefined, history[5])
})
//Issue https://github.com/codigoencasa/bot-whatsapp/issues/865#issuecomment-1747772797
testSuite(`Debe de continuar el el encadenamiento`, async ({ database, provider }) => {
    const flowBuy = addKeyword(['buy', 'BUY'])
        .addAction(async (_, { flowDynamic }) => {
            await flowDynamic([{ body: 'Elegir cartera', buttons: [{ body: 'Wallet A' }, { body: 'Wallet B' }] }])
        })
        .addAction({ capture: true }, async (_, { flowDynamic }) => {
            return flowDynamic([{ body: 'Comprar con', buttons: [{ body: 'ETH' }, { body: 'USDC' }] }])
        })
        .addAction({ capture: true }, async (_, { flowDynamic }) => {
            return flowDynamic([
                { body: 'Comprar cantidad', buttons: [{ body: '0.1' }, { body: '0.5' }, { body: 'CUSTOM' }] },
            ])
        })

    await createBot({
        database,
        flow: createFlow([flowBuy]),
        provider,
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'buy',
    })

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'Wallet A',
    })
    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'USDC',
    })
    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: '0.1',
    })

    await delay(5000)
    const history = database.listHistory.map((item) => item.answer)
    assert.is('__call_action__', history[0])
    assert.is('Elegir cartera', history[1])
    assert.is('__capture_only_intended__', history[2])
    assert.is('Wallet A', history[3])
    assert.is('Comprar con', history[4])
    assert.is('__capture_only_intended__', history[5])
    assert.is('USDC', history[6])
    assert.is('Comprar cantidad', history[7])
    assert.is('0.1', history[8])
    assert.is(undefined, history[9])
})

testSuite.run()
