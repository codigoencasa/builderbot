import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { parseMetaNumber } from '../src/utils'

test('parseMetaNumber: should parse number with plus sign correctly', () => {
    const result = parseMetaNumber('+123')
    assert.equal(result, '+123')
})

test('parseMetaNumber: should remove plus sign correctly', () => {
    const result = parseMetaNumber('123')
    assert.equal(result, '+123')
})

test('parseMetaNumber: should handle multiple plus signs correctly', () => {
    const result = parseMetaNumber('++123')
    assert.equal(result, '+123')
})

test.run()
