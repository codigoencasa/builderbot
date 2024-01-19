import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import { addKeyword, createBot, createFlow, EVENTS } from '../../src'
import { setup, clear, delay } from '../../_mock_/env'

const testSuite = suite('Flujo: manejo de goto')

testSuite.before.each(setup)
testSuite.after.each(clear)

const fakeHTTP = async (fakeData, ms = 50) => {
    await delay(ms)
    return Promise.resolve(fakeData)
}

testSuite('Debe saltar de flujo siguiente', async ({ database, provider }) => {
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

testSuite('Debe saltar de flujo con capture sin flowDynamic', async ({ database, provider }) => {
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

testSuite('Debe saltar de flujo con capture con flowDynamic', async ({ database, provider }) => {
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
testSuite('Debe de continuar el el encadenamiento', async ({ database, provider }) => {
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

    await delay(2000)
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

//Issue https://github.com/codigoencasa/bot-whatsapp/issues/910
testSuite('Debe de continuar el el encadenamiento con procesos async', async ({ database, provider }) => {
    const flowBienvenida = addKeyword(EVENTS.ACTION).addAnswer('Bienvenido!')

    const flowReserva = addKeyword(EVENTS.ACTION)
        .addAction({ ref: '🙌🙌🙌🙌🙌' }, async (_, { flowDynamic }) => {
            const expensiveTask = await fakeHTTP({ data: 'datos de json' }, 800)
            await flowDynamic(expensiveTask.data)
        })
        .addAction({ ref: '🔝🔝🔝🔝' }, async (_, { gotoFlow }) => {
            const expensiveTask = await fakeHTTP({ cliente: 'pepe' }, 800)
            if (expensiveTask.cliente !== 'goyo') {
                return gotoFlow(flowReservaNuevoCliente)
            }
        })

    const flowReservaNuevoCliente = addKeyword('12345').addAnswer(
        'Digame su *Nombre y apellidos* para reservar su mesa...',
        { capture: true, ref: '🔔🔔🔔' },
        async (ctx, { state }) => {
            await state.update({ Nombre: ctx.body, Telefono: ctx.from.slice(2) })
        }
    )

    const flowMain = addKeyword(EVENTS.WELCOME).addAction(async (ctx, ctxFn) => {
        try {
            const expensiveTask = await fakeHTTP(`reserva`, 800)
            switch (expensiveTask) {
                case 'reserva':
                    return ctxFn.gotoFlow(flowReserva)
                default:
                    return ctxFn.gotoFlow(flowBienvenida)
            }
        } catch (e) {
            console.log('Error en el flowMain: ', e)
        }
    })

    await createBot({
        database,
        flow: createFlow([flowMain, flowBienvenida, flowReserva, flowReservaNuevoCliente]),
        provider,
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'buenas',
    })

    await provider.delaySendMessage(3000, 'message', {
        from: '000',
        body: 'leifer',
    })

    await delay(5000)
    const history = database.listHistory.map((item) => item.answer)
    assert.is('__call_action__', history[0])
    assert.is('__capture_only_intended__', history[1])
    assert.is('__capture_only_intended__', history[2])
    assert.is('datos de json', history[3])
    assert.is('Digame su *Nombre y apellidos* para reservar su mesa...', history[4])
    assert.is('leifer', history[5])
    assert.is(undefined, history[6])
})

//Issue https://github.com/codigoencasa/bot-whatsapp/issues/877
testSuite('Debe respectar el delay del node previo', async ({ database, provider }) => {
    const flowPing = addKeyword(['hi']).addAction(async (_, { flowDynamic, gotoFlow }) => {
        await flowDynamic('Buenas ping debe espera 1segundo')
        return gotoFlow(flowBye)
    })

    const flowBye = addKeyword('ping').addAnswer(`Pong con delay 1 segundo`, { delay: 1000 })

    await createBot({
        database,
        flow: createFlow([flowPing, flowBye]),
        provider,
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hi',
    })

    await delay(2000)
    const history = database.listHistory.map((item) => item.answer)
    assert.is('__call_action__', history[0])
    assert.is('Buenas ping debe espera 1segundo', history[1])
    assert.is('Pong con delay 1 segundo', history[2])
    assert.is(undefined, history[3])
})

testSuite.run()
