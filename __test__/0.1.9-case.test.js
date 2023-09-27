const { suite } = require('uvu')
const assert = require('uvu/assert')
const { addKeyword, createBot, createFlow } = require('../packages/bot/index')
const { setup, clear, delay } = require('../__mocks__/env')

const suiteCase = suite('Flujo: addAction (capture)')

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

    await delay(5000)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is('Buenas! ¿Cual es tu nombre? este mensaje debe tener delay 1000', getHistory[0])
    assert.is('Todo bien?', getHistory[1])
    assert.is('Bien!', getHistory[2])
    assert.is('si nada', getHistory[3])
    assert.is('Chao!', getHistory[4])
    assert.is(undefined, getHistory[5])
})

suiteCase.run()
