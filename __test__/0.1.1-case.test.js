const { suite } = require('uvu')
const assert = require('uvu/assert')
const { addKeyword, createBot, createFlow } = require('../packages/bot/index')
const { setup, clear, delay } = require('../__mocks__/env')

const fakeHTTP = async () => {
    await delay(10)
}

const suiteCase = suite('Flujo: hijos con callbacks')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`Debe continuar el flujo del hijo`, async ({ database, provider }) => {
    const flowCash = addKeyword('cash').addAnswer('Traeme los billetes! 😎')

    const flowOnline = addKeyword('paypal')
        .addAnswer('Voy generar un link de paypal *escribe algo*', { capture: true }, async (_, { flowDynamic }) => {
            await fakeHTTP()
            await flowDynamic('Esperate.... estoy generando esto toma su tiempo')
        })
        .addAnswer('Aqui lo tienes 😎😎', null, async (_, { flowDynamic }) => {
            await fakeHTTP()
            await flowDynamic('http://paypal.com')
        })
        .addAnswer('Apurate!')

    const flujoPrincipal = addKeyword('hola')
        .addAnswer('¿Como estas todo bien?')
        .addAnswer('Espero que si')
        .addAnswer('¿Cual es tu email?', { capture: true }, async (ctx, { fallBack }) => {
            if (!ctx.body.includes('@')) {
                return fallBack('Veo que no es um mail *bien*')
            }
        })
        .addAnswer('Voy a validar tu email...', null, async (_, { flowDynamic }) => {
            await fakeHTTP()
            return flowDynamic('Email validado correctamten!')
        })
        .addAnswer('¿Como vas a pagar *paypal* o *cash*?', { capture: true }, async () => {}, [flowCash, flowOnline])

    createBot({
        database,
        flow: createFlow([flujoPrincipal]),
        provider,
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await provider.delaySendMessage(30, 'message', {
        from: '000',
        body: 'test@test.com',
    })

    await provider.delaySendMessage(60, 'message', {
        from: '000',
        body: 'paypal',
    })

    await provider.delaySendMessage(90, 'message', {
        from: '000',
        body: 'continue!',
    })

    await delay(800)
    const getHistory = database.listHistory.map((i) => i.answer)

    assert.is('¿Como estas todo bien?', getHistory[0])
    assert.is('Espero que si', getHistory[1])
    assert.is('¿Cual es tu email?', getHistory[2])
    assert.is('test@test.com', getHistory[3])
    assert.is('Voy a validar tu email...', getHistory[4])
    assert.is('Email validado correctamten!', getHistory[5])
    assert.is('¿Como vas a pagar *paypal* o *cash*?', getHistory[6])
    assert.is('paypal', getHistory[7])
    assert.is('Voy generar un link de paypal *escribe algo*', getHistory[8])
    assert.is('continue!', getHistory[9])
    assert.is('Esperate.... estoy generando esto toma su tiempo', getHistory[10])
    assert.is('Aqui lo tienes 😎😎', getHistory[11])
    assert.is('http://paypal.com', getHistory[12])
    assert.is('Apurate!', getHistory[13])
    assert.is(undefined, getHistory[14])
})

suiteCase.run()
