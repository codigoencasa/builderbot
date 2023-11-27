const { suite } = require('uvu')
const assert = require('uvu/assert')
const { addKeyword, createBot, createFlow } = require('../packages/bot/index')
const { setup, clear, delay } = require('../__mocks__/env')

const suiteCase = suite('Flujo: addAction (capture) encadenados')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`Encadenanos addAction con captures`, async ({ database, provider }) => {
    const flujoPrincipal = addKeyword(['hola'])
        .addAction(async (ctx, { flowDynamic }) => {
            await flowDynamic(`Hola! primer flow dynamic. respondeme algo`)
        })
        .addAction({ capture: true }, async (ctx, { flowDynamic, state }) => {
            const reply = ctx.body
            await state.update({ reply })
            await flowDynamic(`Esto me respondieste ${reply}`)
        })
        .addAction(async (ctx, { flowDynamic }) => {
            await flowDynamic(`Hola! segundo flow dynamic. respondeme algo`)
        })
        .addAction({ capture: true }, async (ctx, { flowDynamic, state }) => {
            const currentState = state.getMyState()?.reply
            const reply = ctx.body
            await state.update({ reply: currentState + ' ' + reply })
            await flowDynamic(`Esto me respondieste ${reply}`)
        })
        .addAnswer('Chao')

    await createBot({
        database,
        flow: createFlow([flujoPrincipal]),
        provider,
    })

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'hola',
    })

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'ping',
    })

    await delay(2000)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is('__call_action__', getHistory[0])
    assert.is('Hola! primer flow dynamic. respondeme algo', getHistory[1])
    assert.is('__capture_only_intended__', getHistory[2])
    assert.is('ping', getHistory[3])
    assert.is('Esto me respondieste ping', getHistory[4])
    assert.is('__call_action__', getHistory[5])
    assert.is('Hola! segundo flow dynamic. respondeme algo', getHistory[6])
    assert.is('__capture_only_intended__', getHistory[7])
    assert.is(undefined, getHistory[8])
})

suiteCase(`Encadenanos addAction con captures and gotoFlow`, async ({ database, provider }) => {
    const flujoPrincipal = addKeyword(['hola'])
        .addAction({ ref: `AAAA1111111111111111111` }, async (ctx, { flowDynamic }) => {
            await flowDynamic(`Bienvenido a mi tienda`)
        })
        .addAction({ ref: `BBB22222222` }, async (ctx, { flowDynamic }) => {
            await flowDynamic(`escribe "ver ofertas"`)
        })

    const flujoSegundario = addKeyword(['ofertas'])
        .addAction({ ref: `5555555555555` }, async (ctx, { flowDynamic }) => {
            await flowDynamic(`Oferta A`)
        })
        .addAction({ ref: `333333333333334` }, async (ctx, { flowDynamic }) => {
            await flowDynamic(`Oferta B`)
        })
        .addAction({ ref: `7777777777777744` }, async (ctx, { flowDynamic }) => {
            await flowDynamic(`Oferta C`)
        })
        .addAction({ ref: `9999999999444444` }, async (ctx, { flowDynamic }) => {
            await flowDynamic(`¿Cual te interesa?`)
        })
        .addAction({ ref: 'oooooooooooooooooo', capture: true }, async (ctx, { state, flowDynamic }) => {
            await state.update({ res1: ctx.body })
            await flowDynamic(`¿Cual es tu email?`)
        })
        .addAction({ ref: `pppppppppppppp`, capture: true }, async (ctx, { state, flowDynamic }) => {
            await state.update({ res2: ctx.body })
            await flowDynamic(`Perfecto te desvio`)
        })
        .addAction({ ref: `DDDDDDDDDDD` }, async (ctx, { gotoFlow }) => {
            return gotoFlow(flujoTercero)
        })

    const flujoTercero = addKeyword(['ordenar'])
        .addAction({ ref: `00000000000000000000000` }, async (ctx, { flowDynamic, state }) => {
            console.log(`🔴🔴🔴🔴`)
            await flowDynamic(`Gracias por el interes`)
        })
        .addAction({ ref: `1111111111111111111` }, async (ctx, { flowDynamic }) => {
            await flowDynamic(`Chao!`)
        })

    await createBot({
        database,
        flow: createFlow([flujoPrincipal, flujoSegundario, flujoTercero]),
        provider,
    })

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'hola',
    })

    await provider.delaySendMessage(150, 'message', {
        from: '000',
        body: 'ofertas',
    })

    await provider.delaySendMessage(200, 'message', {
        from: '000',
        body: 'Ibiza',
    })

    await provider.delaySendMessage(250, 'message', {
        from: '000',
        body: 'test@test.com',
    })

    await provider.delaySendMessage(300, 'message', {
        from: '000',
        body: 'hola',
    })

    await delay(8000)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is('__capture_only_intended__', getHistory[0])
    assert.is('Bienvenido a mi tienda', getHistory[1])
    assert.is('__capture_only_intended__', getHistory[2])
    assert.is('escribe "ver ofertas"', getHistory[3])
    assert.is('ofertas', getHistory[4])
    assert.is('__capture_only_intended__', getHistory[5])
    assert.is('Oferta A', getHistory[6])
    assert.is('__capture_only_intended__', getHistory[7])
    assert.is('Oferta B', getHistory[8])
    assert.is('__capture_only_intended__', getHistory[9])
    assert.is('Oferta C', getHistory[10])
    assert.is('__capture_only_intended__', getHistory[11])
    assert.is('¿Cual te interesa?', getHistory[12])
    assert.is('__capture_only_intended__', getHistory[13])
    assert.is('Ibiza', getHistory[14])
    assert.is('¿Cual es tu email?', getHistory[15])
    assert.is('__capture_only_intended__', getHistory[16])
    assert.is('test@test.com', getHistory[17])
    assert.is('Perfecto te desvio', getHistory[18])
    assert.is('__capture_only_intended__', getHistory[19])
    assert.is('__capture_only_intended__', getHistory[20])
    assert.is('__capture_only_intended__', getHistory[21])
    assert.is('Gracias por el interes', getHistory[22])
    assert.is('Chao!', getHistory[23])
    assert.is('hola', getHistory[24])
    assert.is('__capture_only_intended__', getHistory[25])
    assert.is('Bienvenido a mi tienda', getHistory[26])
    assert.is('__capture_only_intended__', getHistory[27])
    assert.is('escribe "ver ofertas"', getHistory[28])
    assert.is(undefined, getHistory[29])
})

suiteCase(`Encadenanos addAction con captures (infinity)`, async ({ database, provider }) => {
    const flujoPrincipal = addKeyword(['hola'])
        .addAction(async (ctx, { flowDynamic }) => {
            await flowDynamic(`¡Bienvenido a ViajesExtemos!`)
        })
        .addAction(async (ctx, { flowDynamic }) => {
            await flowDynamic(`ver ofertas: Descubre las promociones que tengo para ti`)
        })

    const flujoSegundario = addKeyword(['ofertas'])
        .addAction(async (ctx, { flowDynamic }) => {
            await flowDynamic(`Perfecto te voy enviar los toures con imagenes`)
        })
        .addAction(async (ctx, { flowDynamic }) => {
            await flowDynamic([{ body: `Tour1`, media: 'http://image.img' }])
        })
        .addAction(async (ctx, { flowDynamic }) => {
            await flowDynamic([{ body: `Tour2`, media: 'http://image.img' }])
        })
        .addAction(async (ctx, { flowDynamic }) => {
            await flowDynamic([{ body: `¿Cual de estos tours te interesa?` }])
        })
        .addAction({ capture: true }, async (ctx, { flowDynamic }) => {
            await flowDynamic([{ body: `¿Cual es tu email?` }])
        })
        .addAction({ capture: true }, async (ctx, { flowDynamic, gotoFlow }) => {
            await flowDynamic([{ body: `Perfecto en pocoas minutos un agente se contactar contigo..` }])
            return gotoFlow(flujoTercero)
        })

    const flujoTercero = addKeyword('ordenar')
        .addAction(async (ctx, { flowDynamic }) => {
            await flowDynamic(`También me gustaria mencionar`)
        })
        .addAction(async (ctx, { flowDynamic }) => {
            await flowDynamic(`ping`)
        })
        .addAction(async (ctx, { flowDynamic }) => {
            await flowDynamic(`chao`)
        })

    await createBot({
        database,
        flow: createFlow([flujoPrincipal, flujoSegundario, flujoTercero]),
        provider,
    })

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'hola',
    })

    await provider.delaySendMessage(150, 'message', {
        from: '000',
        body: 'ofertas',
    })

    await provider.delaySendMessage(200, 'message', {
        from: '000',
        body: 'ibiza',
    })

    await provider.delaySendMessage(250, 'message', {
        from: '000',
        body: 'test@test.com',
    })

    await delay(2000)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is('__call_action__', getHistory[0])
    assert.is('¡Bienvenido a ViajesExtemos!', getHistory[1])
    assert.is('__call_action__', getHistory[2])
    assert.is('ver ofertas: Descubre las promociones que tengo para ti', getHistory[3])
    assert.is('ofertas', getHistory[4])
    assert.is('__call_action__', getHistory[5])
    assert.is('Perfecto te voy enviar los toures con imagenes', getHistory[6])
    assert.is('__call_action__', getHistory[7])
    assert.is('Tour1', getHistory[8])
    assert.is('__call_action__', getHistory[9])
    assert.is('Tour2', getHistory[10])
    assert.is('__call_action__', getHistory[11])
    assert.is('¿Cual de estos tours te interesa?', getHistory[12])
    assert.is('__capture_only_intended__', getHistory[13])
    assert.is('ibiza', getHistory[14])
    assert.is('¿Cual es tu email?', getHistory[15])
    assert.is('__capture_only_intended__', getHistory[16])
    assert.is('test@test.com', getHistory[17])
    assert.is('Perfecto en pocoas minutos un agente se contactar contigo..', getHistory[18])
    assert.is('__call_action__', getHistory[19])
    assert.is('__call_action__', getHistory[20])
    assert.is('__call_action__', getHistory[21])
    assert.is('También me gustaria mencionar', getHistory[22])
    assert.is('ping', getHistory[23])
    assert.is('chao', getHistory[24])
    assert.is(undefined, getHistory[25])
})
suiteCase.run()
