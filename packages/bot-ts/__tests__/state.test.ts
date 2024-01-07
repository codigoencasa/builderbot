import { test } from 'uvu'
import * as assert from 'uvu/assert'
import SingleState from '../src/context/stateClass'

const singleState = new SingleState()

test.before.each(() => singleState.clearAll())

test('updateState', async () => {
    const context = { from: 'user1' }
    const keyValue = { key: 'value' }

    await singleState.updateState(context)(keyValue)

    const state = singleState.getMyState(context.from)()
    assert.equal(state, keyValue)
})

test('getMyState', () => {
    const from = 'user2'
    singleState.updateState({ from })({ key: 'value' })

    const state = singleState.getMyState(from)()
    assert.ok(state)
    assert.equal(state, { key: 'value' })
})

test('get', () => {
    const from = 'user3'
    singleState.updateState({ from })({ key: 'value', anotherKey: 'anotherValue' })

    const getKey = singleState.get(from)
    assert.is(getKey('key'), 'value')
    assert.is(getKey('anotherKey'), 'anotherValue')
    assert.is(getKey('nonExistentKey'), undefined)
})

test('getAllState', () => {
    const from1 = 'user4'
    const from2 = 'user5'

    singleState.updateState({ from: from1 })({ key: 'value1' })
    singleState.updateState({ from: from2 })({ key: 'value2' })

    const allStates = [...Array.from(singleState.getAllState())]
    assert.is(allStates.length, 2)
    assert.equal(allStates[0], { key: 'value1' })
    assert.equal(allStates[1], { key: 'value2' })
})

test('clear', () => {
    const from = 'user6'
    singleState.updateState({ from })({ key: 'value' })

    const clear = singleState.clear(from)
    assert.ok(clear())

    const state = singleState.getMyState(from)()
    assert.is(state, undefined)
})

test.run()
