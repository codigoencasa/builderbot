import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import { setup, clear } from '../../_mock_/env'
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
    const getHistory = database.listHistory.map((i: { answer: any }) => i.answer)
    assert.is('__call_action__', getHistory[0])
    assert.is('Buenas! ¿Cual es tu nombre? este mensaje debe tener delay 1000', getHistory[1])
    assert.is('Todo bien?', getHistory[2])
    assert.is('Bien!', getHistory[3])
    assert.is('si nada', getHistory[4])
    assert.is('Chao!', getHistory[5])
    assert.is(undefined, getHistory[6])
})

suiteCase.run()
