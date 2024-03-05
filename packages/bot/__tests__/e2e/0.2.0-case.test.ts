import { suite } from 'uvu'
import * as assert from 'uvu/assert'

import { setup, clear, parseAnswers } from '../../__mock__/env'
import { addKeyword, createBot, createFlow } from '../../src'
import { delay } from '../../src/utils'

const suiteCase = suite('Flujo: addAction (capture) encadenados')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`Encadenanos addAction con captures`, async ({ database, provider }) => {
    const flujoPrincipal = addKeyword(['hola'])
        .addAction(async (_, { flowDynamic }) => {
            await flowDynamic(`Hola! primer flow dynamic. respondeme algo`)
        })
        .addAction({ capture: true }, async (ctx, { flowDynamic, state }) => {
            const reply = ctx.body
            await state.update({ reply })
            await flowDynamic(`Esto me respondieste ${reply}`)
        })
        .addAction(async (_, { flowDynamic }) => {
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
    const history = parseAnswers(database.listHistory).map((item) => item.answer)
    assert.is('Hola! primer flow dynamic. respondeme algo', history[0])
    assert.is('ping', history[1])
    assert.is('Esto me respondieste ping', history[2])
    assert.is('Hola! segundo flow dynamic. respondeme algo', history[3])
    assert.is(undefined, history[4])
})

suiteCase(`Encadenanos addAction con captures and gotoFlow`, async ({ database, provider }) => {
    const flujoPrincipal = addKeyword(['hola'])
        .addAction({ ref: `AAAA1111111111111111111` }, async (_, { flowDynamic }) => {
            await flowDynamic(`Bienvenido a mi tienda`)
        })
        .addAction({ ref: `BBB22222222` }, async (_, { flowDynamic }) => {
            await flowDynamic(`escribe "ver ofertas"`)
        })

    const flujoSegundario = addKeyword(['ofertas'])
        .addAction({ ref: `5555555555555` }, async (_, { flowDynamic }) => {
            await flowDynamic(`Oferta A`)
        })
        .addAction({ ref: `333333333333334` }, async (_, { flowDynamic }) => {
            await flowDynamic(`Oferta B`)
        })
        .addAction({ ref: `7777777777777744` }, async (_, { flowDynamic }) => {
            await flowDynamic(`Oferta C`)
        })
        .addAction({ ref: `9999999999444444` }, async (_, { flowDynamic }) => {
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
        .addAction({ ref: `DDDDDDDDDDD` }, async (_, { gotoFlow }) => {
            return gotoFlow(flujoTercero)
        })

    const flujoTercero = addKeyword(['ordenar'])
        .addAction({ ref: `00000000000000000000000` }, async (_, { flowDynamic }) => {
            await flowDynamic(`Gracias por el interes`)
        })
        .addAction({ ref: `1111111111111111111` }, async (_, { flowDynamic }) => {
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
    const history = parseAnswers(database.listHistory).map((item) => item.answer)
    assert.is('Bienvenido a mi tienda', history[0])
    assert.is('escribe "ver ofertas"', history[1])
    assert.is('ofertas', history[2])
    assert.is('Oferta A', history[3])
    assert.is('Oferta B', history[4])
    assert.is('Oferta C', history[5])
    assert.is('¿Cual te interesa?', history[6])
    assert.is('Ibiza', history[7])
    assert.is('¿Cual es tu email?', history[8])
    assert.is('test@test.com', history[9])
    assert.is('Perfecto te desvio', history[10])
    assert.is('Gracias por el interes', history[11])
    assert.is('Chao!', history[12])
    assert.is('hola', history[13])
    assert.is('Bienvenido a mi tienda', history[14])
    assert.is('escribe "ver ofertas"', history[15])
    assert.is(undefined, history[16])
})

suiteCase(`Encadenanos addAction con captures (infinity)`, async ({ database, provider }) => {
    const flujoPrincipal = addKeyword(['hola'])
        .addAction(async (_, { flowDynamic }) => {
            await flowDynamic(`¡Bienvenido a ViajesExtemos!`)
        })
        .addAction(async (_, { flowDynamic }) => {
            await flowDynamic(`ver ofertas: Descubre las promociones que tengo para ti`)
        })

    const flujoSegundario = addKeyword(['ofertas'])
        .addAction(async (_, { flowDynamic }) => {
            await flowDynamic(`Perfecto te voy enviar los toures con imagenes`)
        })
        .addAction(async (_, { flowDynamic }) => {
            await flowDynamic([{ body: `Tour1`, media: 'http://image.img' }])
        })
        .addAction(async (_, { flowDynamic }) => {
            await flowDynamic([{ body: `Tour2`, media: 'http://image.img' }])
        })
        .addAction(async (_, { flowDynamic }) => {
            await flowDynamic([{ body: `¿Cual de estos tours te interesa?` }])
        })
        .addAction({ capture: true }, async (ctx, { flowDynamic }) => {
            await flowDynamic([{ body: `¿Cual es tu email?` }])
        })
        .addAction({ capture: true }, async (_, { flowDynamic, gotoFlow }) => {
            await flowDynamic([{ body: `Perfecto en pocoas minutos un agente se contactar contigo..` }])
            return gotoFlow(flujoTercero)
        })

    const flujoTercero = addKeyword('ordenar')
        .addAction(async (_, { flowDynamic }) => {
            await flowDynamic(`También me gustaria mencionar`)
        })
        .addAction(async (_, { flowDynamic }) => {
            await flowDynamic(`ping`)
        })
        .addAction(async (_, { flowDynamic }) => {
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
    const history = parseAnswers(database.listHistory).map((item) => item.answer)
    assert.is('¡Bienvenido a ViajesExtemos!', history[0])
    assert.is('ver ofertas: Descubre las promociones que tengo para ti', history[1])
    assert.is('ofertas', history[2])
    assert.is('Perfecto te voy enviar los toures con imagenes', history[3])
    assert.is('Tour1', history[4])
    assert.is('Tour2', history[5])
    assert.is('¿Cual de estos tours te interesa?', history[6])
    assert.is('ibiza', history[7])
    assert.is('¿Cual es tu email?', history[8])
    assert.is('test@test.com', history[9])
    assert.is('Perfecto en pocoas minutos un agente se contactar contigo..', history[10])
    assert.is('También me gustaria mencionar', history[11])
    assert.is('ping', history[12])
    assert.is('chao', history[13])
    assert.is(undefined, history[14])
})
suiteCase.run()
