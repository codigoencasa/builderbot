import { beforeEach, describe, expect, jest, test } from '@jest/globals'

// ── Mocks — must be before any imports that trigger the module graph ──────────

jest.mock('../src/webrtc', () => ({
    createPeerConnection: jest.fn(() => ({
        setRemoteDescription: jest.fn().mockImplementation(() => Promise.resolve()),
        createAnswer: jest.fn().mockImplementation(() =>
            Promise.resolve({
                sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nc=IN IP4 0.0.0.0\r\na=rtpmap:111 opus/48000/2\r\na=setup:actpass\r\n',
            })
        ),
        setLocalDescription: jest.fn().mockImplementation(() => Promise.resolve()),
        addTrack: jest.fn(),
        close: jest.fn(),
        onconnectionstatechange: null,
        ontrack: null,
        connectionState: 'new',
    })),
    createAudioSink: jest.fn(() => ({ stop: jest.fn(), ondata: null })),
    createAudioSource: jest.fn(() => ({
        createTrack: jest.fn(() => ({ kind: 'audio' })),
        onData: jest.fn(),
    })),
}))

jest.mock('../src/meta-call-client', () => ({
    MetaCallClient: jest.fn(() => ({
        preAccept: jest.fn().mockImplementation(() => Promise.resolve()),
        accept: jest.fn().mockImplementation(() => Promise.resolve()),
        reject: jest.fn().mockImplementation(() => Promise.resolve()),
        end: jest.fn().mockImplementation(() => Promise.resolve()),
    })),
}))

jest.mock('../src/audio', () => ({
    SilenceSegmenter: jest.fn(() => ({
        push: jest.fn().mockReturnValue(null),
        flush: jest.fn().mockReturnValue(null),
    })),
    bufferToInt16: jest.fn(() => new Int16Array([1, 2, 3])),
    chunkPcm: jest.fn(() => [new Int16Array([1, 2, 3])]),
    int16ToBuffer: jest.fn(() => Buffer.alloc(6)),
    pcmToWav: jest.fn(() => Buffer.alloc(44)),
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { CallState, CallDirection, CallEvent } from '../src/types'
import type { ISttAdapter, ITtsAdapter, WhatsAppCallEntryEvent } from '../src/types'
import { WhatsAppCallCoreVendor } from '../src/whatsapp-voice/core'

// ── Helpers ───────────────────────────────────────────────────────────────────

const CALL_ID = 'call-test-001'
const CALLER_PHONE = '15551234567'

const BASE_CONFIG = {
    jwtToken: 'jwt',
    numberId: '999',
    verifyToken: 'verify',
    version: 'v20.0',
}

const makeSttAdapter = (result = 'hello world'): ISttAdapter => ({
    transcribe: jest.fn().mockImplementation(() => Promise.resolve(result)) as ISttAdapter['transcribe'],
})

const makeTtsAdapter = (): ITtsAdapter => ({
    synthesize: jest.fn().mockImplementation(() => Promise.resolve(Buffer.alloc(480))) as ITtsAdapter['synthesize'],
    sampleRate: 24000,
})

const connectEvent = (callId = CALL_ID, from = CALLER_PHONE): WhatsAppCallEntryEvent => ({
    id: callId,
    from,
    to: '12345678900',
    event: CallEvent.Connect,
    timestamp: '1762216151',
    direction: CallDirection.UserInitiated,
    session: {
        sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nc=IN IP4 0.0.0.0\r\na=rtpmap:111 opus/48000/2\r\na=setup:actpass\r\n',
        sdp_type: 'offer',
    },
})

type SessionMap = Map<
    string,
    {
        state: CallState
        pc: { close: () => void; connectionState: string }
        sink: { stop: () => void } | null
        source: { onData: () => void; createTrack: () => unknown } | null
        segmenter: { push: () => Buffer | null; flush: () => Buffer | null }
        inboundSampleRate: number
        utteranceQueue: Promise<void>
        callerPhone: string
    }
>

/** Inject a fake active session directly into the core's private sessions map. */
const injectSession = (
    core: WhatsAppCallCoreVendor,
    callId: string,
    callerPhone: string,
    overrides: {
        sink?: { stop: () => void } | null
        source?: { onData: () => void; createTrack: () => unknown } | null
    } = {}
): void => {
    const session = {
        state: CallState.Active,
        pc: { close: jest.fn(), connectionState: 'connected' },
        sink: 'sink' in overrides ? overrides.sink : { stop: jest.fn() },
        source: 'source' in overrides ? overrides.source : { onData: jest.fn(), createTrack: jest.fn() },
        segmenter: {
            push: jest.fn().mockReturnValue(null) as unknown as () => Buffer | null,
            flush: jest.fn().mockReturnValue(null) as unknown as () => Buffer | null,
        },
        inboundSampleRate: 48000,
        utteranceQueue: Promise.resolve(),
        callerPhone,
    }

    ;(core as unknown as { sessions: SessionMap }).sessions.set(callId, session)
    ;(core as unknown as { phoneToCallId: Map<string, string> }).phoneToCallId.set(callerPhone, callId)
}

type UtteranceFn = (pcm: Buffer, sampleRate: number, callId: string) => Promise<void>

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WhatsAppCallCoreVendor', () => {
    let core: WhatsAppCallCoreVendor

    beforeEach(() => {
        jest.clearAllMocks()
        core = new WhatsAppCallCoreVendor({
            sttAdapter: makeSttAdapter(),
            ttsAdapter: makeTtsAdapter(),
            config: BASE_CONFIG as never,
        })
    })

    // ── onTerminate ───────────────────────────────────────────────────────────

    describe('onTerminate', () => {
        test('silently ignores an unknown callId — no notice emitted', () => {
            const notices: unknown[] = []
            core.on('notice', (n) => notices.push(n))

            core.onTerminate('unknown-call-id')

            expect(notices).toHaveLength(0)
        })

        test('emits a notice when a known callId is terminated', () => {
            injectSession(core, CALL_ID, CALLER_PHONE)

            const notices: unknown[] = []
            core.on('notice', (n) => notices.push(n))

            core.onTerminate(CALL_ID)

            expect(notices).toHaveLength(1)
            expect((notices[0] as { title: string }).title).toContain('terminated')
        })

        test('removes the session after termination', () => {
            injectSession(core, CALL_ID, CALLER_PHONE)
            core.onTerminate(CALL_ID)

            const sessions = (core as unknown as { sessions: SessionMap }).sessions
            expect(sessions.has(CALL_ID)).toBe(false)
        })

        test('stops the audio sink on termination', () => {
            const mockStop = jest.fn()
            injectSession(core, CALL_ID, CALLER_PHONE, { sink: { stop: mockStop } })

            core.onTerminate(CALL_ID)

            expect(mockStop).toHaveBeenCalled()
        })

        test('calling onTerminate twice on the same callId does not throw', () => {
            injectSession(core, CALL_ID, CALLER_PHONE)
            core.onTerminate(CALL_ID)

            expect(() => core.onTerminate(CALL_ID)).not.toThrow()
        })
    })

    // ── publishAudio ─────────────────────────────────────────────────────────

    describe('publishAudio', () => {
        test('emits notice when there is no active session', async () => {
            const notices: unknown[] = []
            core.on('notice', (n) => notices.push(n))

            await core.publishAudio('non-existent-call', 'Hello')

            expect(notices).toHaveLength(1)
            expect((notices[0] as { title: string }).title).toContain('no active call')
        })

        test('emits notice when the session has no audio source', async () => {
            injectSession(core, CALL_ID, CALLER_PHONE, { source: null })

            const notices: unknown[] = []
            core.on('notice', (n) => notices.push(n))

            await core.publishAudio(CALL_ID, 'Hello')

            expect(notices).toHaveLength(1)
        })

        test('resolves callerPhone to callId and does not emit notice', async () => {
            injectSession(core, CALL_ID, CALLER_PHONE)
            ;(core as unknown as { ttsAdapter: ITtsAdapter }).ttsAdapter = makeTtsAdapter()

            const notices: unknown[] = []
            core.on('notice', (n) => notices.push(n))

            await core.publishAudio(CALLER_PHONE, 'Hello')

            expect(notices).toHaveLength(0)
        })
    })

    // ── handleUtterance — STT pipeline → message event (FR-4) ────────────────

    describe('handleUtterance — STT pipeline (FR-4)', () => {
        test('emits message with from = callerPhone (not callId) after STT', async () => {
            injectSession(core, CALL_ID, CALLER_PHONE)
            ;(core as unknown as { sttAdapter: ISttAdapter }).sttAdapter = makeSttAdapter('hello world')

            const messages: unknown[] = []
            core.on('message', (m) => messages.push(m))

            await (core as unknown as { handleUtterance: UtteranceFn }).handleUtterance(
                Buffer.alloc(480),
                48000,
                CALL_ID
            )

            expect(messages).toHaveLength(1)
            const msg = messages[0] as { body: string; from: string; name: string }
            expect(msg.body).toBe('hello world')
            expect(msg.from).toBe(CALLER_PHONE)
            expect(msg.name).toBe(CALLER_PHONE)
        })

        test('does NOT emit message when STT returns empty string', async () => {
            injectSession(core, CALL_ID, CALLER_PHONE)
            ;(core as unknown as { sttAdapter: ISttAdapter }).sttAdapter = makeSttAdapter('')

            const messages: unknown[] = []
            core.on('message', (m) => messages.push(m))

            await (core as unknown as { handleUtterance: UtteranceFn }).handleUtterance(
                Buffer.alloc(480),
                48000,
                CALL_ID
            )

            expect(messages).toHaveLength(0)
        })

        test('does NOT emit message when STT returns whitespace only', async () => {
            injectSession(core, CALL_ID, CALLER_PHONE)
            ;(core as unknown as { sttAdapter: ISttAdapter }).sttAdapter = makeSttAdapter('   ')

            const messages: unknown[] = []
            core.on('message', (m) => messages.push(m))

            await (core as unknown as { handleUtterance: UtteranceFn }).handleUtterance(
                Buffer.alloc(480),
                48000,
                CALL_ID
            )

            expect(messages).toHaveLength(0)
        })

        test('emits notice (does not throw) when STT adapter rejects', async () => {
            injectSession(core, CALL_ID, CALLER_PHONE)
            ;(core as unknown as { sttAdapter: ISttAdapter }).sttAdapter = {
                transcribe: jest
                    .fn()
                    .mockImplementation(() => Promise.reject(new Error('STT timeout'))) as ISttAdapter['transcribe'],
            }

            const notices: unknown[] = []
            core.on('notice', (n) => notices.push(n))

            await (core as unknown as { handleUtterance: UtteranceFn }).handleUtterance(
                Buffer.alloc(480),
                48000,
                CALL_ID
            )

            expect(notices).toHaveLength(1)
            expect((notices[0] as { title: string }).title).toContain('transcription error')
        })

        test('message payload includes audio buffer and sampleRate', async () => {
            injectSession(core, CALL_ID, CALLER_PHONE)
            ;(core as unknown as { sttAdapter: ISttAdapter }).sttAdapter = makeSttAdapter('test')

            const messages: unknown[] = []
            core.on('message', (m) => messages.push(m))

            const pcm = Buffer.alloc(480)
            await (core as unknown as { handleUtterance: UtteranceFn }).handleUtterance(pcm, 16000, CALL_ID)

            const msg = messages[0] as { audio: Buffer; sampleRate: number }
            expect(msg.audio).toBe(pcm)
            expect(msg.sampleRate).toBe(16000)
        })
    })

    // ── onConnect happy path ──────────────────────────────────────────────────

    describe('onConnect happy path', () => {
        test('calls preAccept and accept with identical SDP on a valid connect event', async () => {
            const { MetaCallClient } = require('../src/meta-call-client') as {
                MetaCallClient: jest.MockedClass<typeof import('../src/meta-call-client').MetaCallClient>
            }
            await core.onConnect(connectEvent())

            const clientInstance = MetaCallClient.mock.results[0].value as {
                preAccept: jest.MockedFunction<(callId: string, sdp: string) => Promise<void>>
                accept: jest.MockedFunction<(callId: string, sdp: string) => Promise<void>>
            }

            expect(clientInstance.preAccept).toHaveBeenCalledTimes(1)
            expect(clientInstance.accept).toHaveBeenCalledTimes(1)

            const preAcceptSdp = clientInstance.preAccept.mock.calls[0][1]
            const acceptSdp = clientInstance.accept.mock.calls[0][1]

            expect(preAcceptSdp).toBeDefined()
            expect(acceptSdp).toBe(preAcceptSdp)
        })

        test('emits accept failed notice and calls end on Meta when accept rejects', async () => {
            const { MetaCallClient } = require('../src/meta-call-client') as {
                MetaCallClient: jest.MockedClass<typeof import('../src/meta-call-client').MetaCallClient>
            }

            const clientInstance = MetaCallClient.mock.results[0].value as {
                accept: jest.MockedFunction<() => Promise<void>>
                end: jest.MockedFunction<() => Promise<void>>
            }
            clientInstance.accept.mockRejectedValueOnce(new Error('HTTP 400'))

            const notices: unknown[] = []
            core.on('notice', (n) => notices.push(n))

            await core.onConnect(connectEvent())

            expect(clientInstance.end).toHaveBeenCalledTimes(1)
            expect(notices).toHaveLength(1)
            expect((notices[0] as { title: string }).title).toContain('accept failed')
        })
    })

    // ── onConnect state machine guards ────────────────────────────────────────

    describe('onConnect state machine guards', () => {
        test('emits notice and returns early when callId already has an active session', async () => {
            injectSession(core, CALL_ID, CALLER_PHONE)

            const notices: unknown[] = []
            core.on('notice', (n) => notices.push(n))

            await core.onConnect(connectEvent(CALL_ID, CALLER_PHONE))

            expect(notices).toHaveLength(1)
            expect((notices[0] as { title: string }).title).toContain('duplicate connect')
        })

        test('emits notice and returns early when connect event has no SDP', async () => {
            const notices: unknown[] = []
            core.on('notice', (n) => notices.push(n))

            const event = connectEvent()
            delete (event as { session?: unknown }).session

            await core.onConnect(event)

            expect(notices).toHaveLength(1)
            expect((notices[0] as { title: string }).title).toContain('missing SDP')
        })
    })
})
