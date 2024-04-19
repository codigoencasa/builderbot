import { baileyCleanNumber, baileyGenerateImage, baileyIsValidNumber, emptyDirSessions } from '../src/utils'
import { expect, describe, test, jest } from '@jest/globals'
import { utils } from '@builderbot/bot'
import { createWriteStream } from 'fs'
import * as qr from 'qr-image'
import { join } from 'path'
import fsExtra, { NoParamCallback } from 'fs-extra'

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
    createWriteStream: jest.fn().mockReturnValue({
        on: jest.fn(),
    }),
}))

describe('baileyCleanNumber', () => {
    test('should remove @s.whatsapp.net and + when full is true', () => {
        // Arrange
        const originalNumber = '+1234567890@s.whatsapp.net'
        // Act
        const cleanedNumber = baileyCleanNumber(originalNumber, true)
        // Assert
        expect(cleanedNumber).toEqual('1234567890')
    })
})

describe('#baileyIsValidNumber', () => {
    test('should return true if the number is valid', () => {
        // Arrange
        const validNumber = '+1234567890@s.whatsapp.net'

        // Act
        const isValid = baileyIsValidNumber(validNumber)

        // Assert
        expect(isValid).toBe(true)
    })

    test('should return false if the number is invalid', () => {
        // Arrange
        const invalidNumber = '+1234567890@g.us'

        // Act
        const isValid = baileyIsValidNumber(invalidNumber)

        // Assert
        expect(isValid).toBeFalsy()
    })

    test('should return true if the number does not contain @g.us', () => {
        // Arrange
        const numberWithoutGroup = '+1234567890@s.whatsapp.net'

        // Act
        const isValid = baileyIsValidNumber(numberWithoutGroup)

        // Assert
        expect(isValid).toBeTruthy()
    })

    test('should return true if the number is empty', () => {
        // Arrange
        const emptyNumber = ''

        // Act
        const isValid = baileyIsValidNumber(emptyNumber)

        // Assert
        expect(isValid).toBeTruthy()
    })
})

describe('#baileyGenerateImage', () => {
    test('should generate an image file from a base64 string', () => {
        // Arrange
        const base64 = 'yourBase64String'
        const imageName = 'test_image.png'
        const imagePath = join(process.cwd(), imageName)
        const mockWriteStream = {
            on: jest.fn(),
            write: jest.fn(),
            end: jest.fn(),
        }
        const mockPipe = jest.fn().mockReturnValue(mockWriteStream)
        const mockQrSvg = { pipe: mockPipe }
        ;(qr.image as jest.Mock).mockReturnValue(mockQrSvg)
        ;(createWriteStream as jest.Mock).mockReturnValue(jest.fn())

        // Act
        baileyGenerateImage(base64, imageName).then((result) => {
            // Assert
            expect(result).toBeTruthy()
            expect(qr.image).toHaveBeenCalledWith(base64, { type: 'png', margin: 4 })
            expect(utils.cleanImage).toHaveBeenCalledWith(imagePath)
            expect(createWriteStream).toHaveBeenCalledWith(imagePath)
            expect(mockWriteStream.on).toHaveBeenCalledWith('finish', expect.any(Function))
        })
    })
})

describe('#mockEmptyDir', () => {
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
