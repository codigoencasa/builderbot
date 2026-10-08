/**
 * LAYER: Infrastructure
 * Contains: WrapperInteropTests
 * Rules: Mocks baileys with the ESM namespace shape it actually exposes.
 * BigO: O(1) score:5
 * keywords: [WrapperInteropTests, BaileysWrapper, CommonJsInterop]
 * GOAL: Guarantee the default factory stays callable when baileys is loaded as CJS.
 */
import { describe, expect, jest, test } from '@jest/globals'

// baileys is ESM-only: under `require()` the namespace object carries the
// callable factory on `.default`. This mock reproduces that shape, which is what
// broke `dist/index.cjs` (`makeWASocketOther is not a function`).
const makeWASocketMock = jest.fn(() => ({ ev: { on: jest.fn() } }))

jest.mock('baileys', () => ({
    __esModule: true,
    default: makeWASocketMock,
    useMultiFileAuthState: jest.fn(),
    DisconnectReason: { loggedOut: 401 },
    proto: {},
    makeCacheableSignalKeyStore: jest.fn(),
    getAggregateVotesInPollMessage: jest.fn(),
    Browsers: { appropriate: jest.fn() },
    downloadMediaMessage: jest.fn(),
    fetchLatestBaileysVersion: jest.fn(),
    fetchLatestWaWebVersion: jest.fn(),
    isJidGroup: jest.fn(),
    isJidBroadcast: jest.fn(),
    isLidUser: jest.fn(),
}))

describe('baileys wrapper interop (ESM namespace shape)', () => {
    test('default factory is callable even when the module exposes it on .default', async () => {
        const wrapper = await import('../src/baileyWrapper')
        expect(typeof wrapper.makeWASocketOther).toBe('function')
        wrapper.makeWASocketOther({} as any)
        expect(makeWASocketMock).toHaveBeenCalled()
    })

    test('named exports stay available next to the default', async () => {
        const wrapper = await import('../src/baileyWrapper')
        expect(typeof wrapper.useMultiFileAuthState).toBe('function')
        expect(typeof wrapper.Browsers.appropriate).toBe('function')
    })
})
