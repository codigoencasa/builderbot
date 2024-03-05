import { suite } from 'uvu'
import * as assert from 'uvu/assert'

import { setup, clear, parseAnswers } from '../../__mock__/env'
import { addKeyword, createBot, createFlow } from '../../src'
import { delay } from '../../src/utils'

const suiteCase = suite('Flujo: flowDynamic (delay)')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`Delay en los flowDynamic`, async ({ database, provider }) => {
    const flujoPrincipal = addKeyword(['hola'])
        .addAction(async (_, { flowDynamic }) => {
            await flowDynamic('Buenas! ¿Cual es tu nombre? este mensaje debe tener delay 1000', { delay: 1000 })
            await flowDynamic([{ body: 'Todo bien?', delay: 850 }])
        })
        .addAnswer('Bien!', null, async (_, { flowDynamic }) => {
            await flowDynamic('si nada')
        })
        .addAnswer('Chao!')

    await createBot({
        database,
        flow: createFlow([flujoPrincipal]),
        provider,
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await delay(2000)
    const history = parseAnswers(database.listHistory).map((item) => item.answer)
    assert.is('Buenas! ¿Cual es tu nombre? este mensaje debe tener delay 1000', history[0])
    assert.is('Todo bien?', history[1])
    assert.is('Bien!', history[2])
    assert.is('si nada', history[3])
    assert.is('Chao!', history[4])
    assert.is(undefined, history[5])
})

suiteCase.run()
