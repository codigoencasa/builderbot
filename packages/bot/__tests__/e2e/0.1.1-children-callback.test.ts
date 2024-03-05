import { suite } from 'uvu'
import * as assert from 'uvu/assert'

import { setup, clear, parseAnswers } from '../../__mock__/env'
import { addKeyword, createBot, createFlow } from '../../src'
import { delay } from '../../src/utils'

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

    const mainFlow = addKeyword('hola')
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
        flow: createFlow([mainFlow]),
        provider,
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'test@test.com',
    })

    await provider.delaySendMessage(250, 'message', {
        from: '000',
        body: 'paypal',
    })

    await provider.delaySendMessage(250, 'message', {
        from: '000',
        body: 'continue!',
    })

    await delay(800)

    const history = parseAnswers(database.listHistory).map((item) => item.answer)

    assert.is('¿Como estas todo bien?', history[0])
    assert.is('Espero que si', history[1])
    assert.is('¿Cual es tu email?', history[2])
    assert.is('test@test.com', history[3])
    assert.is('Voy a validar tu email...', history[4])
    assert.is('Email validado correctamten!', history[5])
    assert.is('¿Como vas a pagar *paypal* o *cash*?', history[6])
    assert.is('paypal', history[7])
    assert.is('Voy generar un link de paypal *escribe algo*', history[8])
    assert.is('continue!', history[9])
    assert.is('Esperate.... estoy generando esto toma su tiempo', history[10])
    assert.is('Aqui lo tienes 😎😎', history[11])
    assert.is('http://paypal.com', history[12])
    assert.is('Apurate!', history[13])
    assert.is(undefined, history[14])
})

suiteCase.run()
