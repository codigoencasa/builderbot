import { EventEmitter } from 'events'
import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { stub } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import {
    notMatches,
    venomCleanNumber,
    venomGenerateImage,
    venomisValidNumber,
    writeFilePromise,
    venomDownloadMedia,
} from '../src/utils'

const utilsMock = {
    cleanImage: stub(),
}

const httpsMock = {
    get: stub(),
}
test.before.each(() => {
    utilsMock.cleanImage.resetHistory()
    httpsMock.get.resetHistory()
})

test('Cleans the number without appending "@c.us" if full flag is true', () => {
    const inputNumber = '1234567890'
    const cleanedNumber = venomCleanNumber(inputNumber, true)
    assert.is(cleanedNumber, '1234567890')
})

test('Cleans the number and appends "@c.us" if full flag is false', () => {
    const inputNumber = '1234567890'
    const cleanedNumber = venomCleanNumber(inputNumber)
    assert.is(cleanedNumber, '1234567890@c.us')
})

test('Returns true for a valid number not belonging to a group', () => {
    const validNumber = '1234567890@c.us'
    const isValid = venomisValidNumber(validNumber)
    assert.is(isValid, true)
})

test('Returns false for a number belonging to a group', () => {
    const groupNumber = '1234567890@g.us'
    const isValid = venomisValidNumber(groupNumber)
    assert.is(isValid, false)
})

test('Returns true for a valid number without any group identifier', () => {
    const validNumber = '1234567890'
    const isValid = venomisValidNumber(validNumber)
    assert.is(isValid, true)
})

test('writeFilePromise - should resolve to true on success', async () => {
    const imageName = 'test_image.png'
    const imagePath = join(process.cwd(), imageName)
    const matches: RegExpMatchArray | null = ['match1', 'match2', 'match3']

    const response: { type: string; data: Buffer } = {
        type: matches[1],
        data: Buffer.from(matches[2], 'base64'),
    }
    const result = await writeFilePromise(imagePath, response)
    assert.equal(result, true)
    assert.ok(existsSync(imagePath))
    unlinkSync(imagePath)
    assert.not.ok(existsSync(imagePath))
})

test('writeFilePromise - should reject with error message on file write error', async () => {
    const matches: RegExpMatchArray | null = ['match1', 'match2', 'match3']
    const response: { type: string; data: Buffer } = {
        type: matches[1],
        data: Buffer.from(matches[2], 'base64'),
    }
    try {
        await writeFilePromise('', response)
    } catch (error) {
        assert.equal(error, 'ERROR_QR_GENERATE')
    }
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

test('WppConnectGenerateImage - should handle an invalid base64 string and return an error', async () => {
    const base64String = 'cadena-invalida'
    const name = 'qr.png'
    const result = await venomGenerateImage(base64String, name)
    assert.ok(result instanceof Error)
    assert.equal(result.message, 'Invalid input string')
})

test('Generates an image from base64 string', async () => {
    const base64String =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/l8c3gAAAABJRU5ErkJggg=='
    const imageName = 'qr.png'
    const imagePath = join(process.cwd(), imageName)
    utilsMock.cleanImage.call((__, _, callback) => callback(null))
    await venomGenerateImage(base64String, imageName)
    assert.ok(existsSync(imagePath))
    unlinkSync(imagePath)
    assert.not.ok(existsSync(imagePath))
    assert.ok(utilsMock.cleanImage.called)
})

test('Downloads media from a URL using http', async () => {
    const fakeResponse: any = new EventEmitter() as any
    fakeResponse.headers = { 'content-type': 'image/png' }
    const fileName = '2whHCbI.png'
    const url = `http://i.imgur.com/${fileName}`
    const fakeStream: any = new EventEmitter() as any
    fakeStream.close = stub()
    httpsMock.get.callsFake((_, callback) => {
        callback(fakeResponse)
        return fakeStream
    })
    const downloadedPath = await venomDownloadMedia(url)
    assert.equal(downloadedPath.includes('/tmp/tmp-'), true)
})

test.run()
