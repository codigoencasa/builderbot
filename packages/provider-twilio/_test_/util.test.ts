import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { parseNumber } from '../src/utils'

test('parseNumber', () => {
    assert.type(parseNumber, 'function')

    assert.is(parseNumber('whatsapp:123456789'), '123456789', 'Should remove "whatsapp:" prefix')
    assert.is(parseNumber('whatsapp:+123456789'), '123456789', 'Should remove "whatsapp:" prefix and "+" sign')

    assert.is(parseNumber('+123456789'), '123456789', 'Should remove "+" sign')
    assert.is(parseNumber('123456789'), '123456789', 'Should not alter a string without "whatsapp:" or "+"')

    assert.is(
        parseNumber('tel:123456789'),
        'tel:123456789',
        'Should not alter a string that does not start with "whatsapp:" or "+"'
    )
    assert.is(
        parseNumber('123:456789'),
        '123:456789',
        'Should not alter a string that does not start with "whatsapp:" or "+"'
    )

    assert.is(parseNumber(''), '', 'Should return an empty string if input is empty')
    assert.is(parseNumber('whatsapp:'), '', 'Should return an empty string if input is only "whatsapp:"')
    assert.is(parseNumber('+'), '', 'Should return an empty string if input is only "+"')
    assert.is(parseNumber('whatsapp:+'), '', 'Should return an empty string if input is only "whatsapp:+"')
})

test.run()
