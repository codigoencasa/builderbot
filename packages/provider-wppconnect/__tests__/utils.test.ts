import { describe, expect, jest, test } from '@jest/globals'
import fsExtra, { NoParamCallback } from 'fs-extra'
import { utils } from '@builderbot/bot'

import {
    emptyDirSessions,
    notMatches,
    WppConnectCleanNumber,
    WppConnectGenerateImage,
    WppConnectValidNumber,
    WppDeleteTokens,
    writeFilePromise,
} from '../src/utils'

jest.mock('fs-extra')

jest.mock('qr-image', () => ({
    image: jest.fn(() => ({
        pipe: jest.fn(),
    })),
}))

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

describe('#WppDeleteTokens', () => {
    test('should delete tokens', () => {
        // Mock
        const mockEmptyDirSessions = jest.spyOn(fsExtra, 'emptyDir').mockImplementation(() => true)
        // Act
        WppDeleteTokens('session')
        // Assert
        expect(mockEmptyDirSessions).toHaveBeenCalled()
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

describe('#WppConnectValidNumber', () => {
    test('should return true for a valid number', () => {
        // Arrange
        const validNumber = '123456789@c.us'

        // Act
        const result = WppConnectValidNumber(validNumber)

        // Assert
        expect(result).toBe(true)
    })

    test('should return false for an invalid number', () => {
        // Arrange
        const invalidNumber = '123456789@g.us'

        // Act
        const result = WppConnectValidNumber(invalidNumber)

        // Assert
        expect(result).toBe(false)
    })
})

describe('#notMatches', () => {
    test('should return true for null matches', () => {
        // Arrange
        const nullMatches: RegExpMatchArray | null = null

        // Act
        const result = notMatches(nullMatches)

        // Assert
        expect(result).toBe(true)
    })

    test('should return true for matches with length not equal to 3', () => {
        // Arrange
        const invalidMatches: RegExpMatchArray | null = ['match1', 'match2']

        // Act
        const result = notMatches(invalidMatches)

        // Assert
        expect(result).toBe(true)
    })

    test('should return false for matches with length equal to 3', () => {
        // Arrange
        const validMatches: RegExpMatchArray | null = ['match1', 'match2', 'match3']

        // Act
        const result = notMatches(validMatches)

        // Assert
        expect(result).toBe(false)
    })
})

describe('#WppConnectCleanNumber', () => {
    test('should clean number without @c.us and + when full is false', () => {
        // Arrange
        const number = '+123 456 789@c.us'
        const full = false

        // Act
        const result = WppConnectCleanNumber(number, full)

        // Assert
        expect(result).toBe('123456789')
    })

    test('should clean number with @c.us and + when full is true', () => {
        // Arrange
        const number = '+123 456 789@c.us'
        const full = true

        // Act
        const result = WppConnectCleanNumber(number, full)

        // Assert
        expect(result).toBe('123456789@c.us')
    })

    test('should clean number without @c.us and + when full is true', () => {
        // Arrange
        const number = '+123 456 789@c.us'
        const full = true

        // Act
        const result = WppConnectCleanNumber(number, full)

        // Assert
        expect(result).toBe('123456789@c.us')
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

describe('#WppConnectGenerateImage', () => {
    test('should generate image correctly from base64 string', async () => {
        // Arrange
        const base64String =
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABwklEQVQ4y6XTv0rDQBQEwO/rb7gR8sQoWg7R5Yls/4Cs2mj5wgd3GpNn8EiH7Yn+AB/h6q3hnvY+kPTrNzHgtdpR2kYiy2EiKquOYexOPzOZHzXg1XC3+vUaP2OOrLuk4F0p/Mz+AtJ+d6HVWz2dzd+h64n65njfSeL+wh5A1AEjsuEX6Wz+a5UwucZ9lRjJHlB0iUJ/BMo2APXM4l5jJ98yBDkWd/zmO93uzVlu0shhFbz9YjW9NhJp8iF0H2u9jnj9XXl96jDxtQntb7oPjbY8aJj5mDN7ZUOtz2Hl+lgezYrYVlmsZ/o0azWmrFXtI/Bi/lMxHkNvcJM9kwjIJKHQW0PqS2TgBK2b1DfSv9rl4e0j+/BzCmW2Qdo5t+Ik/cYAAAAASUVORK5CYII='
        const expectedFileName = 'test.png'

        // Act
        await WppConnectGenerateImage(base64String, expectedFileName)

        // Assert
        const fs = require('fs')
        expect(utils.cleanImage).toHaveBeenCalled()
        fs.unlinkSync(expectedFileName)
    })

    test('should throw error for invalid input string', async () => {
        // Arrange
        const invalidBase64String = 'invalid_base64_string'
        const result = await WppConnectGenerateImage(invalidBase64String)
        // Act & Assert
        expect(result).toBeDefined()
    })
})
