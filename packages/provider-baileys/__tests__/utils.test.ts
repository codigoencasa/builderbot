import { existsSync, unlinkSync } from 'fs'
import * as path from 'path'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { baileyCleanNumber, baileyGenerateImage, baileyIsValidNumber } from '../src/utils'

test('baileyCleanNumber - adds the suffix "@s.whatsapp.net" if full is false', () => {
    const cleanedNumber = baileyCleanNumber('1234567890', false)
    assert.is(cleanedNumber, '1234567890@s.whatsapp.net')
})

test('baileyCleanNumber - does not add the suffix "@s.whatsapp.net" if full is true', () => {
    const cleanedNumber = baileyCleanNumber('1234567890', true)
    assert.is(cleanedNumber, '1234567890')
})

test('baileyIsValidNumber - returns true for numbers that do not contain the suffix "@g.us"', () => {
    const result = baileyIsValidNumber('1234567890@s.whatsapp.net')
    assert.is(result, true)
})

test('baileyIsValidNumber - returns false for numbers containing the suffix "@g.us"', () => {
    const result = baileyIsValidNumber('1234567890@g.us')
    assert.is(result, false)
})

test('baileyGenerateImage - generate an image from a base64 string', async () => {
    const base64String = 'TU_CADENA_BASE64'
    const imageName = 'test_image.png'
    const imagePath = path.join(process.cwd(), imageName)
    await baileyGenerateImage(base64String, imageName)
    assert.ok(existsSync(imagePath))
    unlinkSync(imagePath)
    assert.not.ok(existsSync(imagePath))
})

test.run()
