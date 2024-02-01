import EventEmitter from 'events'
import { existsSync, unlinkSync } from 'fs-extra'
import { join } from 'path'
import { stub } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { wwebCleanNumber, wwebDownloadMedia, wwebGenerateImage, wwebIsValidNumber } from '../src/utils'
import { utils } from '@bot-whatsapp/bot'

const utilsMock = {
    cleanImage: stub(),
}

const hookClose = async () => {
    await utils.delay(5000)
    process.exit(0)
}

const httpsMock = {
    get: stub(),
}
test.before.each(() => {
    utilsMock.cleanImage.resetHistory()
    httpsMock.get.resetHistory()
})

test.skip('wwebCleanNumber - cleans the number without appending "@c.us" if full flag is true', () => {
    const inputNumber = '1234567890'
    const cleanedNumber = wwebCleanNumber(inputNumber, true)
    assert.is(cleanedNumber, '1234567890')
})

test.skip('Cleans the number and appends "@c.us" if full flag is false', () => {
    const inputNumber = '1234567890'
    const cleanedNumber = wwebCleanNumber(inputNumber)
    assert.is(cleanedNumber, '1234567890@c.us')
})

test.skip('wwebIsValidNumber - debería devolver true para un número válido', () => {
    const rawNumber = '12345'
    const result = wwebIsValidNumber(rawNumber)
    assert.is(result, true)
})

test.skip('wwebIsValidNumber - debería devolver false para un número que contiene el patrón "@g.us"', () => {
    const rawNumber = '12345@g.us'
    const result = wwebIsValidNumber(rawNumber)
    assert.is(result, false)
})

test.skip('wwebGenerateImage - Generates an image from base64 string', async () => {
    const base64String =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/l8c3gAAAABJRU5ErkJggg=='
    const imageName = 'qr.png'
    const imagePath = join(process.cwd(), imageName)
    utilsMock.cleanImage.call((__, _, callback) => callback(null))
    await wwebGenerateImage(base64String, imageName)
    assert.ok(existsSync(imagePath))
    unlinkSync(imagePath)
    assert.not.ok(existsSync(imagePath))
    assert.ok(utilsMock.cleanImage.called)
})

test.skip('Downloads media from a URL using http', async () => {
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
    const downloadedPath = await wwebDownloadMedia(url)
    assert.equal(downloadedPath.includes('tmp-'), true)
})

test.run()
