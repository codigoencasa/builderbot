import { describe, expect, jest, test } from '@jest/globals'
import fsExtra, { NoParamCallback } from 'fs-extra'
import { join } from 'path'
import qr from 'qr-image'
import { createWriteStream } from 'fs'
import fs from 'fs'
import { utils } from '@builderbot/bot'
import os from 'os'

import {
    emptyDirSessions,
    wwebCleanNumber,
    wwebDeleteTokens,
    wwebDownloadMedia,
    wwebGenerateImage,
    wwebGetChromeExecutablePath,
    wwebIsValidNumber,
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

jest.mock('../src/utils', () => ({
    wwebGetWindowsChromeExecutablePath: jest.fn(),
}))

jest.mock('../src/utils', () => ({
    ...(jest.requireActual('../src/utils') as any),
    wwebGetWindowsChromeExecutablePath: jest.fn(),
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

jest.mock('fs', () => ({
    createWriteStream: jest.fn(),
    existsSync: jest.fn(),
    readdirSync: jest.fn(() => []),
    unlinkSync: jest.fn(),
}))

describe('wwebCleanNumber', () => {
    test('it should clean a number properly', () => {
        const inputNumber = '+123 456 789'
        const cleanedNumber = wwebCleanNumber(inputNumber)
        expect(cleanedNumber).toBe('123456789@c.us')
    })
})

describe('wwebIsValidNumber', () => {
    test('it should return true for a valid number', () => {
        const rawNumber = '+123456789'
        expect(wwebIsValidNumber(rawNumber)).toBe(true)
    })

    test('it should return false for a group number', () => {
        const rawNumber = '+123456789@g.us'
        expect(wwebIsValidNumber(rawNumber)).toBe(false)
    })
})

describe('venomDeleteTokens', () => {
    test('should delete tokens', () => {
        // Mock
        const mockEmptyDirSessions = jest.spyOn(fsExtra, 'emptyDir').mockImplementation(() => true)
        // Act
        wwebDeleteTokens('session')
        // Assert
        expect(mockEmptyDirSessions).toHaveBeenCalled()
    })
})

describe('#venomGenerateImage', () => {
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
        wwebGenerateImage(base64, imageName).then((result) => {
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

describe('#wwebGetChromeExecutablePath ', () => {
    test('should return the correct Chrome executable path for Windows', () => {
        // Arrange
        jest.spyOn(os, 'platform').mockReturnValue('win32')
        const mockWindowsChromePath = ''
        jest.spyOn(fs, 'existsSync').mockReturnValueOnce(false)

        // Act
        const result = wwebGetChromeExecutablePath()

        // Assert
        expect(result).toBe(mockWindowsChromePath)
    })

    test('should return the correct Chrome executable path for macOS', () => {
        // Arrange
        jest.spyOn(os, 'platform').mockReturnValue('darwin')

        // Act
        const result = wwebGetChromeExecutablePath()

        // Assert
        expect(result).toBe('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    })

    test('should return the correct Chrome executable path for Linux', () => {
        // Arrange
        jest.spyOn(os, 'platform').mockReturnValue('linux')

        // Act
        const result = wwebGetChromeExecutablePath()

        // Assert
        expect(result).toBe('/usr/bin/google-chrome')
    })

    test('should handle unknown platform and return null', () => {
        // Arrange
        jest.spyOn(os, 'platform').mockReturnValue('some_unknown_platform' as any)
        const consoleErrorSpy = jest.spyOn(console, 'error')

        // Act
        const result = wwebGetChromeExecutablePath()

        // Assert
        expect(result).toBeNull()
        expect(consoleErrorSpy).toHaveBeenCalledWith('Could not find browser.')
    })
})

describe('wwebDownloadMedia', () => {
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
        wwebDownloadMedia(url).then((downloadedPath) => {
            // Assert
            expect(typeof downloadedPath).toBe('string')
            expect(downloadedPath).toContain('tmp-')
        })
    })

    test('should download media from a URL using http  error', () => {
        // Arrange
        const url = 'http://example.com/media.jpg'
        const mockWriteStream = {
            on: jest.fn((event: string, cb: () => void) => {
                if (event === 'error') {
                    cb()
                }
            }),
            close: jest.fn(),
        }
        ;(createWriteStream as jest.Mock).mockReturnValue(mockWriteStream)
        const consoleErrorSpy = jest.spyOn(console, 'error')
        // Act
        wwebDownloadMedia(url).catch(() => expect(consoleErrorSpy).toHaveBeenCalled())
    })
})
