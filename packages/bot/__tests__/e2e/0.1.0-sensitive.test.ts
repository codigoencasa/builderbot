import { suite } from 'uvu'
import * as assert from 'uvu/assert'

import { clear, delay, setup } from '../../__mock__/env'
import { addKeyword, createBot, createFlow } from '../../src'

const testSuite = suite('Flujo: sensitive')

testSuite.before.each(setup)
testSuite.after.each(clear)

testSuite(`Responder a "ole" en minúscula`, async ({ database, provider }) => {
    const sensitiveFlow = addKeyword(['ola', 'ole'], { sensitive: true }).addAnswer('Bienvenido a la OLA')

    await createBot({
        database,
        provider,
        flow: createFlow([sensitiveFlow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'ole',
    })

    await delay(100)

    assert.is('Bienvenido a la OLA', database.listHistory[0].answer)
    assert.is(undefined, database.listHistory[1])
})

testSuite(`NO Responder a "OLE" en mayúscula`, async ({ database, provider }) => {
    const sensitiveFlow = addKeyword(['ola', 'ole'], { sensitive: true }).addAnswer('Bienvenido a la OLA')

    await createBot({
        database,
        provider,
        flow: createFlow([sensitiveFlow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'OLE',
    })

    await delay(100)

    assert.is(undefined, database.listHistory[0])
    assert.is(undefined, database.listHistory[1])
})

testSuite.run()
