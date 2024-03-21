import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { parseMetaNumber } from '../src/utils'

test.skip('parseMetaNumber: should parse number with plus sign correctly', () => {
    const result = parseMetaNumber('+123')
    assert.equal(result, '+123')
})

test.skip('parseMetaNumber: should remove plus sign correctly', () => {
    const result = parseMetaNumber('123')
    assert.equal(result, '+123')
})

test.skip('parseMetaNumber: should handle multiple plus signs correctly', () => {
    const result = parseMetaNumber('++123')
    assert.equal(result, '+123')
})

test.run()
