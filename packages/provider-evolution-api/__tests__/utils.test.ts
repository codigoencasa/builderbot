import { expect, describe, test, jest } from '@jest/globals'
import * as os from 'os'
import * as path from 'path'

// Mock implementations
jest.mock('follow-redirects', () => ({
    https: {
        get: jest.fn((url, options, callback) => {
            if (typeof callback === 'function') {
                callback({
                    pipe: jest.fn(),
                    headers: { 'content-type': 'image/jpeg' },
                })
            }
            return { on: jest.fn() }
        }),
    },
    http: {
        get: jest.fn(),
    },
}))

jest.mock('fs', () => ({
    rename: jest.fn((from, to, callback) => {
        if (typeof callback === 'function') callback(null)
    }),
    createWriteStream: jest.fn(() => ({
        close: jest.fn(),
        on: jest.fn((event, callback) => {
            if (event === 'finish' && typeof callback === 'function') callback()
            return { on: jest.fn() }
        }),
        pipe: jest.fn(),
    })),
    existsSync: jest.fn((filepath: string) => filepath.includes('local')),
}))

jest.mock('mime-types', () => ({
    extension: jest.fn(() => 'jpeg'),
    contentType: jest.fn(() => 'image/jpeg'),
}))

// Import after mocks
import { generalDownload } from '../src/utils/download'

describe('Utils - generalDownload', () => {
    test('should handle remote file downloads', async () => {
        const result = await generalDownload('https://example.com/image.jpg')
        expect(result).toBeDefined()
    })

    test('should handle local files', async () => {
        const mockLocalPath = path.join(os.tmpdir(), 'local-image.jpg')
        const result = await generalDownload(mockLocalPath)
        expect(result).toBeDefined()
    })

    test('should use custom path when provided', async () => {
        const customPath = '/custom/path'
        const result = await generalDownload('https://example.com/image.png', customPath)
        expect(result).toBeDefined()
    })

    test('should accept custom headers', async () => {
        const customHeaders = { Authorization: 'Bearer token' }
        const result = await generalDownload('https://example.com/image.gif', undefined, customHeaders)
        expect(result).toBeDefined()
    })
})
