import { describe, expect, jest, test } from '@jest/globals'
import {
    notMatches,
    venomCleanNumber,
    venomDeleteTokens,
    venomDownloadMedia,
    venomGenerateImage,
    venomisValidNumber,
} from '../src/utils'
import fsExtra from 'fs-extra'
import EventEmitter from 'events'
import { stub } from 'sinon'

const httpsMock = {
    get: stub(),
}

jest.mock('fs-extra')

jest.mock('@builderbot/bot')

describe('#venomCleanNumber', () => {
    test('should clear the number properly', () => {
        const numeroLimpio = venomCleanNumber('+123 456 789')
        expect(numeroLimpio).toBe('123456789@c.us')
    })

    test('I should clear the entire number', () => {
        const numeroLimpio = venomCleanNumber('+123 456 789', true)
        expect(numeroLimpio).toBe('123456789')
    })
})

describe('#venomisValidNumber', () => {
    test('should return true for a valid number', () => {
        const esValido = venomisValidNumber('123456789@c.us')
        expect(esValido).toBe(true)
    })

    test('should return false for an invalid number', () => {
        const esValido = venomisValidNumber('123456789@g.us')
        expect(esValido).toBe(false)
    })
})

describe('#notMatches', () => {
    test('should return true for null', () => {
        const resultado = notMatches(null)
        expect(resultado).toBe(true)
    })

    test('should return true for an array with length other than 3', () => {
        const matches = ['data:image/png;base64,base64String']
        const resultado = notMatches(matches as RegExpMatchArray)
        expect(resultado).toBe(true)
    })

    test('should return false for an array with length 3', () => {
        const matches = ['data:image/png;base64', 'image/png', 'base64String']
        const resultado = notMatches(matches as RegExpMatchArray)
        expect(resultado).toBe(false)
    })
})

describe('venomDeleteTokens', () => {
    test('should delete tokens', () => {
        // Mock
        const mockEmptyDirSessions = jest.spyOn(fsExtra, 'emptyDir').mockImplementation(() => true)
        // Act
        venomDeleteTokens('session')
        // Assert
        expect(mockEmptyDirSessions).toHaveBeenCalled()
    })
})

describe('#venomGenerateImage', () => {
    test('should generate image correctly from base64 string', async () => {
        // Arrange
        const base64String =
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABwklEQVQ4y6XTv0rDQBQEwO/rb7gR8sQoWg7R5Yls/4Cs2mj5wgd3GpNn8EiH7Yn+AB/h6q3hnvY+kPTrNzHgtdpR2kYiy2EiKquOYexOPzOZHzXg1XC3+vUaP2OOrLuk4F0p/Mz+AtJ+d6HVWz2dzd+h64n65njfSeL+wh5A1AEjsuEX6Wz+a5UwucZ9lRjJHlB0iUJ/BMo2APXM4l5jJ98yBDkWd/zmO93uzVlu0shhFbz9YjW9NhJp8iF0H2u9jnj9XXl96jDxtQntb7oPjbY8aJj5mDN7ZUOtz2Hl+lgezYrYVlmsZ/o0azWmrFXtI/Bi/lMxHkNvcJM9kwjIJKHQW0PqS2TgBK2b1DfSv9rl4e0j+/BzCmW2Qdo5t+Ik/cYAAAAASUVORK5CYII='
        const expectedFileName = 'test.png'

        // Act
        await venomGenerateImage(base64String, expectedFileName)

        // Assert
        const fs = require('fs')
        const fileExists = fs.existsSync(expectedFileName)
        expect(fileExists).toBeTruthy()

        fs.unlinkSync(expectedFileName)
    })

    test('should throw error for invalid input string', async () => {
        // Arrange
        const invalidBase64String = 'invalid_base64_string'
        const result = await venomGenerateImage(invalidBase64String)
        // Act & Assert
        expect(result).toBeDefined()
    })
})

describe('#venomDownloadMedia', () => {
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
        expect(downloadedPath).toContain('tmp-')
    })
})
