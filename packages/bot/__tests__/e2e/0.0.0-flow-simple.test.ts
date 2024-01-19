import { suite } from 'uvu'
import * as assert from 'uvu/assert'

import { setup, clear, delay } from '../../_mock_/env'
import { addKeyword, createBot, createFlow } from '../../src'

const testSuite = suite('Flujo: Simple')

testSuite.before.each(setup)
testSuite.after.each(clear)

testSuite(`Responder a "hola"`, async (context) => {
    const { database, provider } = context
    const helloFlow = addKeyword('hola').addAnswer('Buenas!').addAnswer('Como vamos!')
    await createBot({
        database,
        provider,
        flow: createFlow([helloFlow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await delay(50)

    assert.is('Buenas!', database.listHistory[0].answer)
    assert.is('Como vamos!', database.listHistory[1].answer)
    assert.is(undefined, database.listHistory[2])
})

testSuite.skip(`NO responder a "pepe"`, async (context) => {
    const { database, provider } = context
    const helloFlow = addKeyword('hola').addAnswer('Buenas!').addAnswer('Como vamos!')

    await createBot({
        database,
        provider,
        flow: createFlow([helloFlow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'pepe',
    })

    await delay(1000)

    assert.is(undefined, database.listHistory[0])
    assert.is(undefined, database.listHistory[1])
})

testSuite.run()
