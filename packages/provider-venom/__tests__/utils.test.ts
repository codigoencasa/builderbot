import { describe, expect, jest, test } from '@jest/globals'
import {
    emptyDirSessions,
    notMatches,
    venomCleanNumber,
    venomDeleteTokens,
    venomDownloadMedia,
    venomGenerateImage,
    venomisValidNumber,
    writeFilePromise,
} from '../src/utils'
import fsExtra, { NoParamCallback } from 'fs-extra'
import EventEmitter from 'events'
import { stub } from 'sinon'
import { utils } from '@builderbot/bot'
import { createWriteStream } from 'fs'

// const httpsMock = {
//     get: stub(),
// }

jest.mock('fs-extra')

jest.mock('@builderbot/bot')

jest.mock('fs-extra', () => ({
    emptyDir: jest.fn((_path: string, callback: NoParamCallback) => callback(null)),
}))

jest.mock('@builderbot/bot', () => ({
    utils: {
        cleanImage: jest.fn(),
    },
}))

jest.mock('fs', () => ({
    createWriteStream: jest.fn(),
    existsSync: jest.fn(),
    readdirSync: jest.fn(() => []),
    unlinkSync: jest.fn(),
    writeFile: jest.fn((path, data, options, callback: NoParamCallback) => {
        callback(null)
    }),
}))

jest.mock('http', () => ({
    get: jest.fn((_, callback: (res: any) => void) => {
        const response = {
            pipe: jest.fn(),
        }
        callback(response)
    }),
}))

jest.mock('https', () => ({
    get: jest.fn((_, callback: (res: any) => void) => {
        const response = {
            pipe: jest.fn(),
        }
        callback(response)
    }),
}))

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
        expect(utils.cleanImage).toHaveBeenCalled()
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

describe('# const mockEmptyDir = ', () => {
    test('should empty the directory correctly', async () => {
        // Arrange
        const pathBase = '/path/to/directory'
        const mockEmptyDir = jest.fn((_path: string, callback: NoParamCallback) => callback(null))

        jest.spyOn(fsExtra, 'emptyDir').mockImplementation(mockEmptyDir)

        // Act
        await emptyDirSessions(pathBase)

        // Assert
        expect(mockEmptyDir).toHaveBeenCalledWith(pathBase, expect.any(Function))
    })

    test('should handle errors when emptying the directory', async () => {
        // Arrange
        const pathBase = '/path/to/directory'
        const error = new Error('Failed to empty directory')
        const mockEmptyDir = jest.fn((_path: string, callback: NoParamCallback) => callback(error))

        jest.spyOn(fsExtra, 'emptyDir').mockImplementation(mockEmptyDir)

        // Act & Assert
        await expect(emptyDirSessions(pathBase)).rejects.toEqual(error)
    })
})

describe('writeFilePromise', () => {
    test('should resolve with true when writeFile is successful', () => {
        // Arrange
        const pathQr = 'testPath'
        const response: any = { data: 'testData' }
        // Act
        writeFilePromise(pathQr, response).then((result) => {
            // Assert
            expect(result).toBe(true)
        })
    })

    test('should reject with error message when writeFile encounters an error', async () => {
        // Arrange
        const pathQr = 'testPath'
        const response: any = { data: 'testData' }
        require('fs').writeFile.mockImplementationOnce((path, data, options, callback) => {
            callback('some error')
        })

        // Act & Assert
        await expect(writeFilePromise(pathQr, response)).rejects.toEqual('ERROR_QR_GENERATE')
    })
})

describe('venomDownloadMedia ', () => {
    test('should download media from a URL using http', () => {
        // Arrange
        const url = 'http://example.com/media.jpg'
        const mockWriteStream = {
            on: jest.fn((event: string, cb: () => void) => {
                if (event === 'finish') {
                    cb()
                }
            }),
            close: jest.fn(),
        }
        ;(createWriteStream as jest.Mock).mockReturnValue(mockWriteStream)
        // Act
        venomDownloadMedia(url).then((downloadedPath) => {
            // Assert
            expect(typeof downloadedPath).toBe('string')
            expect(downloadedPath).toContain('tmp-')
        })
    })
})
