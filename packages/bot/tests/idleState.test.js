const { test } = require('uvu')
const assert = require('uvu/assert')
const IdleState = require('../context/idleState.class')

test(`[IdleState] Probando instanciamiento de clase`, async () => {
    const idleState = new IdleState()

    idleState.setIdleTime({ from: '000', inRef: 'ref1', timeInSeconds: 10 })
    const queue = idleState.get({ from: '000' })
    assert.is(idleState instanceof IdleState, true)
    assert.is(queue, true)
})

test.run()
