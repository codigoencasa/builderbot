// Mock the @builderbot/bot dependency first
jest.mock('@builderbot/bot', () => {
    return {
        ProviderClass: class MockProvider {
            server: any
            constructor() {
                this.server = {
                    use: jest.fn().mockReturnThis(),
                    post: jest.fn().mockReturnThis(),
                }
            }
            emit = jest.fn()
            middleware = jest.fn()
            handleCtx = jest.fn()
        },
    }
})

import { expect, describe, test, jest } from '@jest/globals'

import { EvolutionProvider } from '../src/evolution/provider'

// Mock all external dependencies
jest.mock('axios', () => ({
    get: jest.fn(() => Promise.resolve({ data: { state: 'open' } })),
    post: jest.fn(() => Promise.resolve({ data: { id: 'message-id-123' } })),
}))

jest.mock('../src/utils', () => ({
    generalDownload: jest.fn(() => Promise.resolve('/tmp/test-file.jpg')),
}))

jest.mock('fs', () => ({
    readFileSync: jest.fn(() => 'base64_encoded_content'),
    existsSync: jest.fn(() => true),
}))

jest.mock('fs/promises', () => ({
    writeFile: jest.fn(() => Promise.resolve()),
}))

jest.mock('mime-types', () => ({
    lookup: jest.fn(() => 'image/jpeg'),
    contentType: jest.fn(() => 'image/jpeg'),
}))

// Mock ffmpeg and related modules
jest.mock('@ffmpeg-installer/ffmpeg', () => ({
    path: '/mock/path/to/ffmpeg',
}))

// Mock any potential FFmpeg/fluent-ffmpeg modules
jest.mock('fluent-ffmpeg', () => {
    const mockFfmpeg = () => ({
        setFfmpegPath: jest.fn(),
        on: jest.fn().mockReturnThis(),
        save: jest.fn().mockReturnThis(),
        run: jest.fn().mockReturnThis(),
    })
    mockFfmpeg.setFfmpegPath = jest.fn()
    return mockFfmpeg
})

// Mock other potential dependencies that might be causing issues
jest.mock('polka', () => ({
    default: jest.fn(() => ({
        use: jest.fn().mockReturnThis(),
        listen: jest.fn().mockReturnThis(),
        post: jest.fn().mockReturnThis(),
    })),
}))

jest.mock('queue-promise', () => {
    return jest.fn().mockImplementation(() => ({
        add: jest.fn(),
        on: jest.fn(),
    }))
})

describe('EvolutionProvider', () => {
    test('should initialize with correct vendor args', () => {
        const provider = new EvolutionProvider({
            name: 'test-bot',
            apiKey: 'test-api-key',
            baseURL: 'http://localhost:8080',
            instanceName: 'test-instance',
            port: 3000,
        })

        expect(provider.globalVendorArgs).toEqual({
            name: 'test-bot',
            apiKey: 'test-api-key',
            baseURL: 'http://localhost:8080',
            instanceName: 'test-instance',
            port: 3000,
        })
    })

    test('should have correct structure', () => {
        // Just check if the class is defined correctly
        expect(EvolutionProvider).toBeDefined()
        expect(typeof EvolutionProvider).toBe('function')
    })
})
