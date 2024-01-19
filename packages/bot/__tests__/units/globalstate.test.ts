import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { GlobalState } from '../../src/context/globalstateClass'

const globalState = new GlobalState()
test.before.each(() => globalState.clear()())

test('GlobalState - instantiation', () => {
    assert.instance(globalState, GlobalState)
})

test('GlobalState - updateState', async () => {
    const updateFn = globalState.updateState()
    const getStateFn = globalState.getMyState()

    await updateFn({ key1: 'value1' })
    assert.equal(getStateFn(), { key1: 'value1' })

    await updateFn({ key2: 'value2' })
    assert.equal(getStateFn(), { key1: 'value1', key2: 'value2' })
})

test('GlobalState - getMyState', async () => {
    const updateFn = globalState.updateState()
    const getStateFn = globalState.getMyState()

    await updateFn({ key1: 'value1' })
    assert.equal(getStateFn(), { key1: 'value1' })
})

test('GlobalState - get', async () => {
    const updateFn = globalState.updateState()
    const getFn = globalState.get()

    await updateFn({ key1: 'value1', key2: 'value2' })
    assert.is(getFn('key1'), 'value1')
    assert.is(getFn('key2'), 'value2')
    assert.is(getFn('key3'), undefined)
})

test('GlobalState - getAllState', async () => {
    const updateFn = globalState.updateState()
    await updateFn({ key1: 'value1' })
    const allStateIterator = globalState.getAllState()

    const allStateValues = Array.from(allStateIterator)
    assert.equal(allStateValues, [{ key1: 'value1' }])
})

test('GlobalState - clear', async () => {
    const updateFn = globalState.updateState()
    const clearFn = globalState.clear()
    const getStateFn = globalState.getMyState()

    await updateFn({ key1: 'value1' })
    assert.not.equal(getStateFn(), undefined)

    clearFn()
    assert.equal(getStateFn(), {})
})

test.run()
