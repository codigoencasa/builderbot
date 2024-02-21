import { AxiosResponse } from 'axios'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { httpsMock } from '../__mock__/http'
import { downloadFile, fileTypeFromFile } from '../src/utils'

const token = 'myToken'

test('downloadFile - should return media url correctly', async () => {
    const url = 'https://example.com/file.jpg'

    const responseData = new Uint8Array([72, 101, 108, 108, 111])
    const responseHeaders = { 'content-type': 'image/jpeg' }
    const mockedResponse = {
        data: responseData,
        headers: responseHeaders,
    }

    httpsMock.get.resolves(mockedResponse)

    const result = await downloadFile(url, token)
    assert.equal(result.buffer, responseData)
    assert.is(result.extension, 'jpeg')
})

test('downloadFile  - It should return an invalid extension error', async () => {
    const url = 'https://example.com/file.jpg'

    const responseData = new Uint8Array([72, 101, 108, 108, 111])
    const responseHeaders = { 'content-type': 'test' }
    const mockedResponse = {
        data: responseData,
        headers: responseHeaders,
    }

    httpsMock.get.resolves(mockedResponse)
    const errorMessage = ' Unable to determine file extension'

    try {
        const result = await downloadFile(url, token)
        assert.is(result, undefined)
    } catch (error) {
        assert.equal(error.message, errorMessage)
    }
})

test('downloadFile  - should handle errors and return undefined', async () => {
    const url = 'https://example.com/file.jpg'
    const errorMessage = 'Some error'
    httpsMock.get.throws(errorMessage)

    try {
        const result = await await downloadFile(url, token)
        assert.is(result, undefined)
    } catch (error) {
        assert.equal(error.message, errorMessage)
    }
})

test('fileTypeFromFile extracts type and extension correctly', async () => {
    const response: AxiosResponse = {
        headers: {
            'content-type': 'image/jpeg',
        },
    } as unknown as AxiosResponse

    const result = await fileTypeFromFile(response)

    assert.is(result.type, 'image/jpeg')
    assert.is(result.ext, 'jpeg')
})

test('fileTypeFromFile - It should return the type empty and the extension false', async () => {
    const response: AxiosResponse = {
        headers: {},
    } as unknown as AxiosResponse

    const result = await fileTypeFromFile(response)

    assert.is(result.type, '')
    assert.is(result.ext, false)
})

test.run()
