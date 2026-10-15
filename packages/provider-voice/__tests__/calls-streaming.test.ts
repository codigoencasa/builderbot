import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

jest.mock('../src/calls/webrtc', () => ({
    createPeerConnection: jest.fn(() => ({
        setRemoteDescription: jest.fn(async () => {}),
        createAnswer: jest.fn(async () => ({
            sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\na=setup:actpass\r\n',
        })),
        setLocalDescription: jest.fn(async () => {}),
        addTrack: jest.fn(),
        close: jest.fn(),
        connectionState: 'new',
    })),
    createAudioSink: jest.fn(() => ({ stop: jest.fn(), ondata: null })),
    createAudioSource: jest.fn(() => ({ createTrack: jest.fn(() => ({ kind: 'audio' })), onData: jest.fn() })),
    waitForIceGathering: jest.fn(async () => {}),
}))
jest.mock('../src/calls/meta-call-client', () => ({
    MetaCallClient: jest.fn(() => ({ preAccept: jest.fn(async () => {}), accept: jest.fn(async () => {}) })),
}))

import type { ITtsAdapter, TtsSynthesisOptions } from '../src/adapters'
import { MetaCallCoreVendor } from '../src/calls/core'
import { CallDirection, CallEvent } from '../src/calls/types'
import type { WhatsAppCallEntryEvent } from '../src/calls/types'
import { createAudioSource } from '../src/calls/webrtc'

const RATE = 48000
const FRAME = RATE / 100 // 10 ms
const config = { jwtToken: 'test', numberId: 'test', version: 'v20.0' }
const event = (id: string): WhatsAppCallEntryEvent => ({
    id,
    from: `caller-${id}`,
    to: 'business',
    event: CallEvent.Connect,
    timestamp: '0',
    direction: CallDirection.UserInitiated,
    session: { sdp: 'offer', sdp_type: 'offer' },
})
/** El mock del AudioSource: `onData` es un jest.Mock aunque el tipo sea el real. */
type MockSource = { onData: jest.Mock<(data: { samples: Int16Array }) => void> }
const lastSource = (): MockSource => {
    const results = jest.mocked(createAudioSource).mock.results
    return results[results.length - 1].value as unknown as MockSource
}
const silence = (samples: number, value = 1000) => Buffer.from(new Int16Array(samples).fill(value).buffer)

const deferred = <T>() => {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((r) => (resolve = r))
    return { promise, resolve }
}

/** Adaptador con streaming: trozos de tamaño arbitrario y ritmo controlado por el test. */
class StreamingTts implements ITtsAdapter {
    readonly sampleRate = RATE
    public consumed = 0
    public closed = false
    public signal?: AbortSignal
    constructor(
        private readonly chunks: Array<{ samples: number; gate?: Promise<void> }>,
        private readonly failAfter?: number
    ) {}
    async synthesize(): Promise<Buffer> {
        return silence(FRAME)
    }
    async *synthesizeStream(_text: string, options?: TtsSynthesisOptions): AsyncIterable<Buffer> {
        this.signal = options?.signal
        try {
            for (const [index, chunk] of this.chunks.entries()) {
                if (options?.signal?.aborted) return
                if (chunk.gate) await chunk.gate
                if (this.failAfter !== undefined && index >= this.failAfter) throw new Error('TTS roto a mitad')
                this.consumed += chunk.samples
                yield silence(chunk.samples)
            }
        } finally {
            this.closed = true
        }
    }
}

describe('streamed TTS playback', () => {
    const cores: MetaCallCoreVendor[] = []
    const setup = async (ttsAdapter: ITtsAdapter) => {
        const core = new MetaCallCoreVendor({ sttAdapter: { transcribe: async () => '' }, ttsAdapter, config })
        cores.push(core)
        await core.onConnect(event('a'))
        return core
    }
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => {
        for (const core of cores.splice(0)) core.onTerminate('a')
        jest.useRealTimers()
    })

    test('empieza a enviar audio antes de que el stream termine', async () => {
        const gate = deferred<void>()
        const tts = new StreamingTts([{ samples: FRAME }, { samples: FRAME, gate: gate.promise }])
        const core = await setup(tts)
        const source = lastSource()
        const publishing = core.publishAudio('a', 'hola')

        await jest.advanceTimersByTimeAsync(30)
        // El primer trozo ya suena aunque el segundo aún no se ha generado.
        expect(source.onData.mock.calls.length).toBeGreaterThan(0)
        expect(tts.closed).toBe(false)

        gate.resolve()
        await jest.advanceTimersByTimeAsync(100)
        await publishing
        expect(source.onData).toHaveBeenCalledTimes(2)
        expect(tts.closed).toBe(true)
    })

    test('reenmarca trozos de tamaño arbitrario al ritmo real (10 ms por trama)', async () => {
        // 3,5 tramas de audio: el resto se rellena con una última trama completa.
        const tts = new StreamingTts([{ samples: FRAME }, { samples: Math.round(FRAME * 2.5) }])
        const core = await setup(tts)
        const source = lastSource()
        const publishing = core.publishAudio('a', 'hola')
        await jest.advanceTimersByTimeAsync(200)
        await publishing
        expect(source.onData).toHaveBeenCalledTimes(4)
        for (const [frame] of source.onData.mock.calls) expect(frame.samples.length).toBe(FRAME)
    })

    test('un stream lento no adelanta audio: emite una trama por tick', async () => {
        const tts = new StreamingTts([{ samples: FRAME * 5 }])
        const core = await setup(tts)
        const source = lastSource()
        const publishing = core.publishAudio('a', 'hola')
        await jest.advanceTimersByTimeAsync(10)
        expect(source.onData).toHaveBeenCalledTimes(1)
        await jest.advanceTimersByTimeAsync(10)
        expect(source.onData).toHaveBeenCalledTimes(2)
        await jest.advanceTimersByTimeAsync(100)
        await publishing
        expect(source.onData).toHaveBeenCalledTimes(5)
    })

    test('interrumpir cierra el stream y deja de enviar', async () => {
        const gate = deferred<void>()
        const tts = new StreamingTts([{ samples: FRAME }, { samples: FRAME, gate: gate.promise }, { samples: FRAME }])
        const core = await setup(tts)
        const source = lastSource()
        const publishing = core.publishAudio('a', 'hola')
        await jest.advanceTimersByTimeAsync(20)
        const before = source.onData.mock.calls.length

        core.cancelResponse('a')
        await publishing
        expect(tts.signal?.aborted).toBe(true)

        gate.resolve()
        await jest.advanceTimersByTimeAsync(200)
        expect(source.onData.mock.calls.length).toBe(before)
        expect(tts.consumed).toBeLessThan(FRAME * 3)
    })

    test('colgar cierra el stream', async () => {
        const gate = deferred<void>()
        const tts = new StreamingTts([{ samples: FRAME }, { samples: FRAME, gate: gate.promise }])
        const core = await setup(tts)
        const publishing = core.publishAudio('a', 'hola')
        await jest.advanceTimersByTimeAsync(20)
        core.onTerminate('a')
        await publishing
        gate.resolve()
        await jest.advanceTimersByTimeAsync(50)
        expect(tts.closed).toBe(true)
    })

    test('un error a mitad del stream rechaza y no deja timers vivos', async () => {
        const tts = new StreamingTts([{ samples: FRAME }, { samples: FRAME }], 1)
        const core = await setup(tts)
        const publishing = core.publishAudio('a', 'hola')
        const failed = expect(publishing).rejects.toThrow('TTS roto a mitad')
        await jest.advanceTimersByTimeAsync(100)
        await failed
        expect(jest.getTimerCount()).toBe(0)
    })

    test('el stream vacío resuelve sin enviar nada', async () => {
        const tts = new StreamingTts([])
        const core = await setup(tts)
        const source = lastSource()
        const publishing = core.publishAudio('a', 'hola')
        await jest.advanceTimersByTimeAsync(20)
        await publishing
        expect(source.onData).not.toHaveBeenCalled()
        expect(jest.getTimerCount()).toBe(0)
    })

    test('sin synthesizeStream sigue usando el camino de Buffer', async () => {
        const calls: string[] = []
        const core = await setup({
            sampleRate: RATE,
            synthesize: async (text) => {
                calls.push(text)
                return silence(FRAME)
            },
        })
        const source = lastSource()
        const publishing = core.publishAudio('a', 'hola')
        await jest.advanceTimersByTimeAsync(20)
        await publishing
        expect(calls).toEqual(['hola'])
        expect(source.onData).toHaveBeenCalledTimes(1)
    })
})
