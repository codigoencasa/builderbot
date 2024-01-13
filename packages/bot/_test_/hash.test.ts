import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { generateRefprovider, encryptData, decryptData } from '../src/utils/hash'

test('generateRefprovider', () => {
    assert.type(generateRefprovider, 'function')

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const refNoPrefix = generateRefprovider()
    const refWithPrefix = generateRefprovider('prefix')

    assert.match(refNoPrefix, uuidRegex, 'should generate a valid UUID')
    assert.match(
        refWithPrefix,
        /^prefix_[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        'should generate a valid UUID with prefix'
    )
})

test('encryptData and decryptData', () => {
    const originalData = 'Hello, World!'
    const encryptedData = encryptData(originalData)
    const decryptedData = decryptData(encryptedData)
    assert.is.not(encryptedData, originalData, 'encrypted data should not match original data')
    assert.is(decryptedData, originalData, 'decrypted data should match original data')
})

test.run()
