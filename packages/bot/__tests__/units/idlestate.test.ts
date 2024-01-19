import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { IdleState } from '../../src/context/idlestateClass'

const idleState = new IdleState()

test('IdleState - setIdleTime', () => {
    const callbackSpy = {
        called: false,
        callContext: null,
        callback: function (context: { next: boolean; inRef: any }) {
            this.called = true
            this.callContext = context
        },
    }

    idleState.setIdleTime({
        from: 'test',
        inRef: {},
        timeInSeconds: 1,
        cb: callbackSpy.callback.bind(callbackSpy),
    })

    assert.type(idleState.setIdleTime, 'function')
    setTimeout(() => {
        assert.ok(callbackSpy.called)
    }, 1500)
})

test('IdleState - get', () => {
    const testRef = {}

    idleState.setIdleTime({
        from: 'test',
        inRef: testRef,
        timeInSeconds: 2,
    })

    assert.type(idleState.get, 'function')
    const resultBeforeTimeout = idleState.get({ from: 'test', inRef: testRef })
    assert.is(resultBeforeTimeout, true)

    setTimeout(() => {
        const resultAfterTimeout = idleState.get({ from: 'test', inRef: testRef })
        assert.is(resultAfterTimeout, false)
    }, 2500)
})

test('IdleState - stop', () => {
    const testRef = {}
    const callbackSpy = {
        called: false,
        callContext: null,
        callback: function (context: { next: boolean; inRef: any }) {
            this.called = true
            this.callContext = context
        },
    }

    idleState.setIdleTime({
        from: 'test',
        inRef: testRef,
        timeInSeconds: 3,
        cb: callbackSpy.callback.bind(callbackSpy),
    })

    assert.type(idleState.stop, 'function')
    idleState.stop({ from: 'test', inRef: testRef })

    setTimeout(() => {
        assert.ok(callbackSpy.called)
    }, 1000)
})

test.run()
