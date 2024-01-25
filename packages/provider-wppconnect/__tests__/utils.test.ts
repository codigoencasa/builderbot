import proxyquire from 'proxyquire'
import { stub } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { Response } from '../src/types'

const fsMock = {
    writeFile: stub(),
}

const utilsMock = {
    cleanImage: stub().resolves(),
}

const { writeFilePromise, WppConnectGenerateImage, WppConnectCleanNumber, WppConnectValidNumber, notMatches } =
    proxyquire<typeof import('../src/utils')>('../src/utils', {
        '@bot-whatsapp/bot': { utils: utilsMock },
        fs: fsMock,
    })

test.after.each(() => {
    fsMock.writeFile.resetHistory()
    utilsMock.cleanImage.resetHistory()
})

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

test('notMatches - should return true if there are no matches', () => {
    const matches: RegExpMatchArray | null = null
    const result = notMatches(matches)
    assert.equal(result, true)
})

test('notMatches - should return true if match length is not 3', () => {
    const matches: RegExpMatchArray | null = ['match1', 'match2']
    const result = notMatches(matches)
    assert.equal(result, true)
})

test('notMatches - should return false if there are matches and length is 3', () => {
    const matches: RegExpMatchArray | null = ['match1', 'match2', 'match3']
    const result = notMatches(matches)
    assert.equal(result, false)
})

test('writeFilePromise - should resolve to true on success', async () => {
    const matches: RegExpMatchArray | null = ['match1', 'match2', 'match3']
    const pathQr = 'ruta-de-prueba'
    const response: Response = {
        type: matches[1],
        data: Buffer.from(matches[2], 'base64'),
    }
    const result = await writeFilePromise(pathQr, response)
    assert.equal(result, true)
})

test('should reject with error message on file write error', async () => {
    const matches: RegExpMatchArray | null = ['match1', 'match2', 'match3']
    const response: Response = {
        type: matches[1],
        data: Buffer.from(matches[2], 'base64'),
    }
    try {
        await writeFilePromise('', response)
    } catch (error) {
        assert.equal(error, 'ERROR_QR_GENERATE')
    }
})

test('WppConnectGenerateImage - should handle an invalid base64 string and return an error', async () => {
    const base64String = 'cadena-invalida'
    const name = 'qr.png'
    const result = await WppConnectGenerateImage(base64String, name)
    assert.ok(result instanceof Error)
    assert.equal(result.message, 'Invalid input string')
})

test.run()
