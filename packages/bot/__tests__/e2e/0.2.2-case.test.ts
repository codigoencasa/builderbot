import { suite } from 'uvu'
import * as assert from 'uvu/assert'

import { setup, clear } from '../../__mock__/env'
import { addKeyword, createBot, createFlow, EVENTS } from '../../src'
import { delay } from '../../src/utils'

const suiteCase = suite('DEMO Flujo: idle state')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

// [ ] Cunado se ejecuta endFlow y luego tiene un capture:true queda esperando la respuesta

suiteCase.skip(`Prevenir enviar mensaje luego de inactividad (2seg)`, async ({ database, provider }) => {
    const flujoPrincipal = addKeyword(EVENTS.WELCOME)
        .addAnswer('Dime una opcion A,B,C?', { capture: true }, async (ctx, { endFlow }) => {
            const response = ctx.body
            if (response.toLowerCase() === 'b') return endFlow()
        })
        .addAnswer('Cual es tu edad?', { capture: true }, async (ctx, { flowDynamic }) => {
            await flowDynamic('Gracias')
        })

    const bot = await createBot({
        database,
        flow: createFlow([flujoPrincipal]),
        provider,
    })

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'hola',
    })

    await provider.delaySendMessage(150, 'message', {
        from: '000',
        body: 'B',
    })

    await provider.delaySendMessage(200, 'message', {
        from: '000',
        body: 'otra',
    })

    await delay(3000)
    const getHistory = database.listHistory.map((i: { answer: any }) => i.answer)
    assert.is('debes de responder antes de que transcurran 2 segundos (2000)', getHistory)
    bot.queuePrincipal.clearQueue('000')
})

suiteCase.run()
