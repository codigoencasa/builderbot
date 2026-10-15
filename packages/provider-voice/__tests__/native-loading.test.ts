import { beforeEach, describe, expect, jest, test } from '@jest/globals'

/** The public barrel must not initialize native engines an application never uses. */
describe('native backend isolation', () => {
    let livekitLoads: number
    let wrtcLoads: number

    beforeEach(() => {
        jest.resetModules()
        livekitLoads = 0
        wrtcLoads = 0
        jest.doMock('@livekit/rtc-node', () => {
            livekitLoads++
            return { Room: jest.fn(() => ({})) }
        })
        jest.doMock('@roamhq/wrtc', () => {
            wrtcLoads++
            return { nonstandard: { RTCAudioSource: jest.fn(() => ({ createTrack: jest.fn() })) } }
        })
    })

    test('importing the barrel and using PCM helpers loads neither native backend', () => {
        const { frameRms } = require('../src/index')
        expect(frameRms(new Int16Array(480))).toBe(0)
        expect(livekitLoads).toBe(0)
        expect(wrtcLoads).toBe(0)
    })

    test('creating WhatsApp media loads wrtc but not LiveKit', () => {
        const { createAudioSource } = require('../src/index')
        createAudioSource()
        expect(wrtcLoads).toBe(1)
        expect(livekitLoads).toBe(0)
    })

    test('initializing the LiveKit provider does not load wrtc', async () => {
        const { VoiceProvider } = require('../src/index')
        const provider = new VoiceProvider({
            sttAdapter: { transcribe: async () => '' },
            ttsAdapter: { sampleRate: 48000, synthesize: async () => Buffer.alloc(0) },
        })
        await provider['initVendor']()
        expect(livekitLoads).toBe(1)
        expect(wrtcLoads).toBe(0)
    })
})
