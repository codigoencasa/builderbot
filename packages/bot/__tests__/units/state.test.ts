import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { SingleState } from '../../src/context/stateClass'

const singleState = new SingleState()

test.before.each(() => singleState.clearAll())

test('updateState', async () => {
    const context = { from: 'user1' }
    const keyValue = { key: 'value' }

    await singleState.updateState(context)(keyValue)

    const state = singleState.getMyState(context.from)()
    assert.equal(state, keyValue)
})

test('getMyState', async () => {
    const from = 'user2'
    await singleState.updateState({ from })({ key: 'value' })

    const state = singleState.getMyState(from)()
    assert.ok(state)
    assert.equal(state, { key: 'value' })
})

test('get', async () => {
    const from = 'user3'
    await singleState.updateState({ from })({ key: 'value', anotherKey: 'anotherValue' })

    const getKey = singleState.get(from)
    assert.is(getKey('key'), 'value')
    assert.is(getKey('anotherKey'), 'anotherValue')
    assert.is(getKey('nonExistentKey'), undefined)
})

test('get.join', async () => {
    const from = 'user3'
    await singleState.updateState({ from })({ user: { name: 'leifer', email: 'leifer@test.com' } })

    const getKey = singleState.get(from)
    assert.is(getKey('user.name'), 'leifer')
    assert.is(getKey('user.email'), 'leifer@test.com')
    assert.is(getKey('nonExistentKey'), undefined)
})

test('getAllState', async () => {
    const from1 = 'user4'
    const from2 = 'user5'

    await singleState.updateState({ from: from1 })({ key: 'value1' })
    await singleState.updateState({ from: from2 })({ key: 'value2' })

    const allStates = [...Array.from(singleState.getAllState())]
    assert.is(allStates.length, 2)
    assert.equal(allStates[0], { key: 'value1' })
    assert.equal(allStates[1], { key: 'value2' })
})

test('clear', async () => {
    const from = 'user6'
    await singleState.updateState({ from })({ key: 'value' })

    const clear = singleState.clear(from)
    assert.ok(clear())

    const state = singleState.getMyState(from)()
    assert.is(state, undefined)
})

// Tests for __end_flow__ feature
test('get __end_flow__ returns undefined when not set', async () => {
    const from = 'user_endflow_1'
    const endFlowFlag = singleState.get(from)('__end_flow__') || false
    assert.is(endFlowFlag, false)
})

test('get __end_flow__ returns true after setting it', async () => {
    const from = 'user_endflow_2'
    await singleState.updateState({ from })({ __end_flow__: true })

    const endFlowFlag = singleState.get(from)('__end_flow__') || false
    assert.is(endFlowFlag, true)
})

test('get __end_flow__ returns false after resetting it', async () => {
    const from = 'user_endflow_3'

    // First set it to true
    await singleState.updateState({ from })({ __end_flow__: true })
    let endFlowFlag = singleState.get(from)('__end_flow__') || false
    assert.is(endFlowFlag, true)

    // Then reset it to false
    await singleState.updateState({ from })({ __end_flow__: false })
    endFlowFlag = singleState.get(from)('__end_flow__') || false
    assert.is(endFlowFlag, false)
})

test('__end_flow__ is independent per user', async () => {
    const user1 = 'user_endflow_4'
    const user2 = 'user_endflow_5'

    // Set __end_flow__ true for user1
    await singleState.updateState({ from: user1 })({ __end_flow__: true })
    // Set __end_flow__ false for user2
    await singleState.updateState({ from: user2 })({ __end_flow__: false })

    const endFlowUser1 = singleState.get(user1)('__end_flow__') || false
    const endFlowUser2 = singleState.get(user2)('__end_flow__') || false

    assert.is(endFlowUser1, true)
    assert.is(endFlowUser2, false)
})

test('__end_flow__ preserves other state properties', async () => {
    const from = 'user_endflow_6'

    // Set initial state with some properties
    await singleState.updateState({ from })({ name: 'John', email: 'john@test.com' })

    // Update __end_flow__ without losing other properties
    await singleState.updateState({ from })({ __end_flow__: true })

    const endFlowFlag = singleState.get(from)('__end_flow__')
    const name = singleState.get(from)('name')
    const email = singleState.get(from)('email')

    assert.is(endFlowFlag, true)
    assert.is(name, 'John')
    assert.is(email, 'john@test.com')
})

test.run()
