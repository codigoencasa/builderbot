import { beforeEach, describe, expect, jest, test } from '@jest/globals'

/**
 * Regression tests for the lazy-loading of `@builderbot/provider-voice`.
 *
 * `@builderbot/provider-voice` transitively requires `@roamhq/wrtc`, a native
 * addon that only ships prebuilt binaries for a subset of platforms/architectures.
 * `MetaProvider` must only touch that module graph when a bot explicitly opts in
 * with `enableVoiceCalls: true` — never as a side effect of simply requiring
 * `@builderbot/provider-meta` or constructing/starting a `MetaProvider` without
 * voice calls enabled.
 *
 * Each test uses `jest.resetModules()` + `require(...)` (instead of the
 * module-level `jest.mock` used in `provider.test.ts`) so the real import
 * graph of `../src/meta/provider` is exercised for real, with only
 * `@roamhq/wrtc` (or `@builderbot/provider-voice`) swapped out via `jest.doMock`.
 */
describe('#MetaProvider — lazy @builderbot/provider-voice loading', () => {
    const baseArgs = {
        name: 'bot',
        jwtToken: 'token',
        numberId: '1234567890',
        verifyToken: 'verify-token',
        version: 'v18.0',
    }

    beforeEach(() => {
        jest.resetModules()
    })

    test('initVendor() never requires @roamhq/wrtc when enableVoiceCalls is not set', async () => {
        // Arrange — if `@roamhq/wrtc` (or provider-voice) is required at all, blow up loudly.
        jest.doMock('@roamhq/wrtc', () => {
            throw new Error('@roamhq/wrtc must not be required when enableVoiceCalls is not set')
        })
        jest.doMock('@builderbot/provider-voice', () => {
            throw new Error('@builderbot/provider-voice must not be required when enableVoiceCalls is not set')
        })

        const { MetaProvider } = require('../src/meta/provider')
        const provider = new MetaProvider({ ...baseArgs })

        // Act & Assert — must resolve without ever touching the mocked (throwing) modules.
        await expect(provider['initVendor']()).resolves.toBeDefined()
        expect(provider.callVendor).toBeUndefined()
    })

    test('saveFile() without ctx.audio never requires @builderbot/provider-voice', async () => {
        jest.doMock('@builderbot/provider-voice', () => {
            throw new Error('@builderbot/provider-voice must not be required for non-voice saveFile calls')
        })
        jest.doMock('../src/utils', () => ({
            downloadFile: jest.fn(() => Promise.resolve({ buffer: Buffer.from('x'), extension: 'jpg' })),
            getOrderDetails: jest.fn(),
            getProfile: jest.fn(),
        }))
        jest.doMock('fs/promises', () => ({ writeFile: jest.fn(() => Promise.resolve()) }))

        const { MetaProvider } = require('../src/meta/provider')
        const provider = new MetaProvider({ ...baseArgs })

        // Act & Assert — a regular (non voice-call) file context must not trigger the dynamic import.
        const result = await provider.saveFile({ url: 'https://example.com/file.jpg' })
        expect(result).not.toBe('ERROR')
    })

    test('enabling enableVoiceCalls lazily loads @builderbot/provider-voice and builds the call vendor', async () => {
        const onMock = jest.fn()
        const MetaCallCoreVendorMock = jest.fn().mockImplementation(() => ({ on: onMock }))
        const OpenAISTTAdapterMock = jest.fn().mockImplementation(() => ({ transcribe: jest.fn() }))
        const OpenAITTSAdapterMock = jest.fn().mockImplementation(() => ({ synthesize: jest.fn(), sampleRate: 24000 }))

        jest.doMock('@builderbot/provider-voice', () => ({
            MetaCallCoreVendor: MetaCallCoreVendorMock,
            OpenAISTTAdapter: OpenAISTTAdapterMock,
            OpenAITTSAdapter: OpenAITTSAdapterMock,
            pcmToWav: jest.fn(),
        }))

        const { MetaProvider } = require('../src/meta/provider')
        const provider = new MetaProvider({
            ...baseArgs,
            enableVoiceCalls: true,
            openaiApiKey: 'sk-test',
        })

        // Act
        await provider['initVendor']()

        // Assert — the call vendor is only built now, once voice calls are enabled.
        expect(MetaCallCoreVendorMock).toHaveBeenCalledTimes(1)
        expect(OpenAISTTAdapterMock).toHaveBeenCalledWith({ apiKey: 'sk-test' })
        expect(OpenAITTSAdapterMock).toHaveBeenCalledWith({ apiKey: 'sk-test' })
        expect(provider.callVendor).toBeDefined()
    })
})
