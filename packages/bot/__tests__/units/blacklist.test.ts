import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { BlackList } from '../../src/utils/blacklistClass'

test('constructor', () => {
    const blacklist = new BlackList(['123', '456'])
    assert.ok(blacklist.checkIf('123'))
    assert.ok(blacklist.checkIf('456'))
    assert.not.ok(blacklist.checkIf('789'))
})

test('add', () => {
    const blacklist = new BlackList()
    let response = blacklist.add('123')
    assert.equal(response, ['Número 123 añadido exitosamente.'])
    assert.ok(blacklist.checkIf('123'))

    response = blacklist.add('123')
    assert.equal(response, ['El número de teléfono 123 ya está en la lista negra.'])
})

test('remove', () => {
    const blacklist = new BlackList(['123'])
    assert.ok(blacklist.checkIf('123'))

    blacklist.remove('123')
    assert.not.ok(blacklist.checkIf('123'))

    try {
        blacklist.remove('456')
        assert.unreachable('should have thrown')
    } catch (error) {
        assert.instance(error, Error)
    }
})

test('checkIf', () => {
    const blacklist = new BlackList(['123'])
    assert.ok(blacklist.checkIf('123'))
    assert.not.ok(blacklist.checkIf('456'))
})

test('getList', () => {
    const blacklist = new BlackList(['123', '456'])
    const list = blacklist.getList()
    assert.equal(list, ['123', '456'])
})

test('PhoneNumberAlreadyExistsError', () => {
    const blacklist = new BlackList(['123'])
    const response = blacklist.add('123')
    assert.equal(response, ['El número de teléfono 123 ya está en la lista negra.'])
})

test.run()
