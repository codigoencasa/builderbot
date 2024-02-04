import { suite } from 'uvu'
import * as assert from 'uvu/assert'

import { setup, clear, delay, parseAnswers } from '../../__mock__/env'
import { addKeyword, createBot, createFlow } from '../../src'
import { MemoryDBClass } from '../../src/db'
import { ProviderMock } from '../../src/provider/providerMock'

const testSuite = suite<{ provider: ProviderMock; database: MemoryDBClass }>('Flujo: Simple')

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

    const dbParse = parseAnswers(database.listHistory)
    assert.is('Buenas!', dbParse[0].answer)
    assert.is('Como vamos!', dbParse[1].answer)
    assert.is(undefined, dbParse[2])
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
