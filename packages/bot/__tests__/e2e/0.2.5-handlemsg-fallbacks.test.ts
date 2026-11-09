import { suite } from 'uvu'
import * as assert from 'uvu/assert'

import { clear, delay, setup } from '../../__mock__/env'
import { EVENTS, addKeyword, createBot, createFlow } from '../../src'
import { generateRefProvider } from '../../src/utils'

const suiteCase = suite('Flujo: fallbacks de handleMsg (nested sin match y WELCOME)')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`Nested sin match y con capture: procesa la captura sin buscar keywords globales`, async (context) => {
    const { database, provider } = context
    const captured: string[] = []

    const flowA = addKeyword('opcion-a').addAnswer('Elegiste A')
    const globalFlow = addKeyword('hola').addAnswer('Respuesta global')
    const welcomeFlow = addKeyword(EVENTS.WELCOME).addAnswer('Bienvenido')
    const menuFlow = addKeyword('menu').addAnswer(
        'Elige *opcion-a*',
        { capture: true },
        async (ctx) => {
            captured.push(ctx.body)
        },
        [flowA]
    )

    await createBot({
        database,
        provider,
        flow: createFlow([menuFlow, globalFlow, welcomeFlow]),
    })

    await provider.delaySendMessage(0, 'message', { from: '000', body: 'menu' })
    await provider.delaySendMessage(50, 'message', { from: '000', body: 'hola' })

    await delay(300)
    const history = database.listHistory.map((item) => item.answer)
    assert.ok(history.includes('Elige *opcion-a*'))
    assert.not.ok(history.includes('Respuesta global'), 'No debe saltar a un flujo global')
    assert.not.ok(history.includes('Bienvenido'), 'No debe responder WELCOME')
    assert.equal(captured, ['hola'], 'El callback del capture debe recibir el mensaje')
})

suiteCase(`Nested sin match y sin capture: cae en las keywords globales`, async (context) => {
    const { database, provider } = context

    const flowA = addKeyword('opcion-a').addAnswer('Elegiste A')
    const globalFlow = addKeyword('hola').addAnswer('Respuesta global')
    const menuFlow = addKeyword('menu').addAnswer('Puedes escribir *opcion-a*', null, null, [flowA])

    await createBot({
        database,
        provider,
        flow: createFlow([menuFlow, globalFlow]),
    })

    await provider.delaySendMessage(0, 'message', { from: '000', body: 'menu' })
    await provider.delaySendMessage(50, 'message', { from: '000', body: 'hola' })

    await delay(300)
    const history = database.listHistory.map((item) => item.answer)
    assert.ok(history.includes('Puedes escribir *opcion-a*'))
    assert.ok(history.includes('Respuesta global'), 'Debe responder el flujo global')
    assert.not.ok(history.includes('Elegiste A'))
})

suiteCase(`Evento sin flujo registrado: responde WELCOME como fallback`, async (context) => {
    const { database, provider } = context
    const welcomeFlow = addKeyword(EVENTS.WELCOME).addAnswer('Bienvenido')

    await createBot({
        database,
        provider,
        flow: createFlow([welcomeFlow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: generateRefProvider('_event_media_'),
    })

    await delay(200)
    const history = database.listHistory.map((item) => item.answer)
    assert.is(history[0], 'Bienvenido')
    assert.is(history[1], undefined)
})

suiteCase(`Evento con flujo registrado: gana el flujo del evento sobre WELCOME`, async (context) => {
    const { database, provider } = context
    const welcomeFlow = addKeyword(EVENTS.WELCOME).addAnswer('Bienvenido')
    const mediaFlow = addKeyword(EVENTS.MEDIA).addAnswer('Gracias por la imagen')

    await createBot({
        database,
        provider,
        flow: createFlow([welcomeFlow, mediaFlow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: generateRefProvider('_event_media_'),
    })

    await delay(200)
    const history = database.listHistory.map((item) => item.answer)
    assert.is(history[0], 'Gracias por la imagen')
    assert.not.ok(history.includes('Bienvenido'))
})

suiteCase.run()
