import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { WppConnectCleanNumber, WppConnectValidNumber } from '../src/utils'

test('WppConnectCleanNumber - Remove "@c.us" of the number', () => {
    const inputNumber = '123@c.us'
    const expectedOutput = '123'

    const result = WppConnectCleanNumber(inputNumber)

    assert.is(result, expectedOutput)
})

test('WppConnectCleanNumber - Add "@c.us" to the number if full is true', () => {
    const inputNumber = '123'
    const expectedOutput = '123@c.us'

    const result = WppConnectCleanNumber(inputNumber, true)

    assert.is(result, expectedOutput)
})

test('WppConnectValidNumber - Returns true for valid numbers', () => {
    const validNumber = '123'

    const result = WppConnectValidNumber(validNumber)

    assert.equal(result, true)
})

test('WppConnectValidNumber - Returns false for group numbers', () => {
    const groupNumber = '123@g.us'

    const result = WppConnectValidNumber(groupNumber)

    assert.equal(result, false)
})

test.run()
