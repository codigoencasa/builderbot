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
    MetaCallClient: jest.fn(() => ({
        preAccept: jest.fn(async () => {}),
        accept: jest.fn(async () => {}),
        end: jest.fn(async () => {}),
        reject: jest.fn(async () => {}),
    })),
}))

import type { ITtsAdapter, TtsSynthesisOptions } from '../src/adapters'
import { MetaCallCoreVendor } from '../src/calls/core'
import { CallDirection, CallEvent } from '../src/calls/types'
import type { WhatsAppCallEntryEvent } from '../src/calls/types'
import { createAudioSink, createAudioSource, createPeerConnection } from '../src/calls/webrtc'

type FakeMetaClient = Record<
    'preAccept' | 'accept' | 'end' | 'reject',
    jest.Mock<(...args: unknown[]) => Promise<void>>
>
const metaClientOf = (core: MetaCallCoreVendor) => (core as unknown as { metaClient: FakeMetaClient }).metaClient

const deferred = <T>() => {
    let resolve!: (value: T) => void
    let reject!: (reason: Error) => void
    const promise = new Promise<T>((yes, no) => {
        resolve = yes
        reject = no
    })
    return { promise, resolve, reject }
}
const event = (id: string): WhatsAppCallEntryEvent => ({
    id,
    from: `caller-${id}`,
    to: 'business',
    event: CallEvent.Connect,
    timestamp: '0',
    direction: CallDirection.UserInitiated,
    session: { sdp: 'offer', sdp_type: 'offer' },
})
const pcm = (value = 1000) => Buffer.from(new Int16Array(480 * 3).fill(value).buffer)
const config = { jwtToken: 'test', numberId: 'test', version: 'v20.0' }
const lastSource = () => {
    const results = jest.mocked(createAudioSource).mock.results
    return results[results.length - 1].value as ReturnType<typeof createAudioSource>
}
const speech = () => {
    const connections = jest.mocked(createPeerConnection).mock.results
    const pc = connections[connections.length - 1].value as RTCPeerConnection
    pc.ontrack!({ track: { kind: 'audio' } } as RTCTrackEvent)
    const sinks = jest.mocked(createAudioSink).mock.results
    const sink = sinks[sinks.length - 1].value as ReturnType<typeof createAudioSink>
    // Exercise the real segmenter's 120ms detection, not an artificial interruption event.
    for (let i = 0; i < 12; i++)
        sink.ondata!({
            samples: new Int16Array(480).fill(4000),
            sampleRate: 48000,
            channelCount: 1,
            numberOfFrames: 480,
            bitsPerSample: 16,
        })
}

describe('call-scoped cancellation with real PCM segmentation', () => {
    const cores: MetaCallCoreVendor[] = []
    const setup = async (ttsAdapter: ITtsAdapter) => {
        const core = new MetaCallCoreVendor({ sttAdapter: { transcribe: async () => 'hello' }, ttsAdapter, config })
        cores.push(core)
        await core.onConnect(event('a'))
        return core
    }
    beforeEach(() => {
        jest.clearAllMocks()
        jest.useFakeTimers()
    })
    afterEach(() => {
        for (const core of cores.splice(0)) {
            core.onTerminate('a')
            core.onTerminate('b')
        }
        jest.useRealTimers()
    })

    test('speech cancels synthesis before first audio, including an adapter ignoring signal', async () => {
        const gate = deferred<Buffer>()
        let signal: AbortSignal | undefined
        const core = await setup({
            sampleRate: 48000,
            synthesize: (_text, options) => {
                signal = options?.signal
                return gate.promise
            },
        })
        const interrupted = jest.fn()
        core.on('playback_interrupted', interrupted)
        const output = lastSource()
        const publishing = core.publishAudio('a', 'old response')
        await jest.advanceTimersByTimeAsync(0)
        speech()
        await publishing // Must resolve BEFORE the non-cancellable adapter.
        expect(signal?.aborted).toBe(true)
        expect(interrupted).toHaveBeenCalledWith({ callId: 'a', from: 'caller-a' })
        gate.resolve(pcm())
        await jest.advanceTimersByTimeAsync(100)
        expect(output.onData).not.toHaveBeenCalled()
    })

    test('queued output is dropped after interruption; next response still plays', async () => {
        const gate = deferred<Buffer>()
        const synthesize = jest
            .fn<ITtsAdapter['synthesize']>()
            .mockImplementationOnce(() => gate.promise)
            .mockResolvedValue(pcm())
        const core = await setup({ sampleRate: 48000, synthesize })
        const first = core.publishAudio('a', 'old first')
        const second = core.publishAudio('a', 'old second')
        await jest.advanceTimersByTimeAsync(0)
        core.cancelResponse('caller-a')
        await Promise.all([first, second])
        expect(synthesize).toHaveBeenCalledTimes(1)
        const third = core.publishAudio('a', 'new turn')
        await jest.advanceTimersByTimeAsync(100)
        await third
        expect(synthesize).toHaveBeenCalledTimes(2)
        expect(lastSource().onData).toHaveBeenCalledTimes(3)
        gate.reject(new Error('late failure must be observed'))
        await jest.advanceTimersByTimeAsync(0)
    })

    test('concurrent publishers serialize rather than overwrite their playback timers', async () => {
        const synthesize = jest
            .fn<ITtsAdapter['synthesize']>()
            .mockImplementation(async (text) => pcm(text === 'first' ? 1000 : 2000))
        const core = await setup({ sampleRate: 48000, synthesize })
        const first = core.publishAudio('a', 'first')
        const second = core.publishAudio('a', 'second')
        await jest.advanceTimersByTimeAsync(100)
        await Promise.all([first, second])
        const values = jest.mocked(lastSource().onData).mock.calls.map(([frame]) => frame.samples[0])
        expect(values).toEqual([1000, 1000, 1000, 2000, 2000, 2000])
    })

    test('cancelling one call never cancels the other call', async () => {
        const options: TtsSynthesisOptions[] = []
        const core = await setup({
            sampleRate: 48000,
            synthesize: async (_text, context) => {
                options.push(context!)
                return pcm()
            },
        })
        const sourceA = lastSource()
        await core.onConnect(event('b'))
        const sourceB = lastSource()
        const a = core.publishAudio('a', 'response A')
        const b = core.publishAudio('b', 'response B')
        await jest.advanceTimersByTimeAsync(5)
        core.cancelResponse('a')
        await jest.advanceTimersByTimeAsync(100)
        await Promise.all([a, b])
        expect(sourceA.onData).toHaveBeenCalledTimes(1)
        expect(sourceB.onData).toHaveBeenCalledTimes(3)
        expect(options.find((option) => option.callId === 'a')!.signal!.aborted).toBe(true)
        expect(options.find((option) => option.callId === 'b')!.signal!.aborted).toBe(false)
    })

    test('speech is announced while no audio exists yet (LLM can be cancelled)', async () => {
        const core = await setup({ sampleRate: 48000, synthesize: async () => pcm() })
        const started = jest.fn()
        const interrupted = jest.fn()
        core.on('user_speech_started', started)
        core.on('playback_interrupted', interrupted)
        speech()
        expect(started).toHaveBeenCalledWith({ callId: 'a', from: 'caller-a' })
        expect(interrupted).not.toHaveBeenCalled()
    })

    test('hang-up discards late synthesis and does not wait for its HTTP request', async () => {
        const gate = deferred<Buffer>()
        const core = await setup({ sampleRate: 48000, synthesize: () => gate.promise })
        const output = lastSource()
        const publishing = core.publishAudio('a', 'old')
        await jest.advanceTimersByTimeAsync(0)
        core.onTerminate('a')
        await publishing
        gate.resolve(pcm())
        await jest.advanceTimersByTimeAsync(100)
        expect(output.onData).not.toHaveBeenCalled()
    })

    test('STT finishing after hang-up never emits a message', async () => {
        const gate = deferred<string>()
        const core = new MetaCallCoreVendor({
            sttAdapter: { transcribe: () => gate.promise },
            ttsAdapter: { sampleRate: 48000, synthesize: async () => pcm() },
            config,
        })
        cores.push(core)
        await core.onConnect(event('a'))
        const messages = jest.fn()
        core.on('message', messages)
        const transcribing = (core as any).handleUtterance(pcm(), 48000, 'a') as Promise<void>
        core.onTerminate('a')
        gate.resolve('must not reach a flow')
        await transcribing
        expect(messages).not.toHaveBeenCalled()
    })

    test('empty audio resolves without creating a playback timer', async () => {
        const core = await setup({ sampleRate: 48000, synthesize: async () => Buffer.alloc(0) })
        await core.publishAudio('a', '')
        expect(lastSource().onData).not.toHaveBeenCalled()
        expect(jest.getTimerCount()).toBe(0)
    })

    test('queued utterances preserve their capture sample rate', async () => {
        const gate = deferred<string>()
        const transcribe = jest
            .fn<(pcm: Buffer, rate: number) => Promise<string>>()
            .mockImplementationOnce(() => gate.promise)
            .mockResolvedValue('second')
        const core = new MetaCallCoreVendor({
            sttAdapter: { transcribe },
            ttsAdapter: { sampleRate: 48000, synthesize: async () => pcm() },
            config,
        })
        cores.push(core)
        await core.onConnect(event('a'))
        const session = (core as any).sessions.get('a')
        ;(core as any).enqueueUtterance(session, pcm(), 'a')
        session.inboundSampleRate = 16000
        ;(core as any).enqueueUtterance(session, pcm(), 'a')
        session.inboundSampleRate = 32000
        await jest.advanceTimersByTimeAsync(0)
        gate.resolve('first')
        await session.utteranceQueue
        expect(transcribe.mock.calls.map(([, rate]) => rate)).toEqual([48000, 16000])
    })

    test('queued STT is never started after hang-up', async () => {
        const gate = deferred<string>()
        const transcribe = jest.fn<() => Promise<string>>().mockImplementation(() => gate.promise)
        const core = new MetaCallCoreVendor({
            sttAdapter: { transcribe },
            ttsAdapter: { sampleRate: 48000, synthesize: async () => pcm() },
            config,
        })
        cores.push(core)
        await core.onConnect(event('a'))
        const session = (core as any).sessions.get('a')
        ;(core as any).enqueueUtterance(session, pcm(), 'a')
        ;(core as any).enqueueUtterance(session, pcm(), 'a')
        await jest.advanceTimersByTimeAsync(0)
        core.onTerminate('a')
        gate.resolve('late')
        await session.utteranceQueue
        expect(transcribe).toHaveBeenCalledTimes(1)
    })

    test('release stops the outbound track and detaches native callbacks', async () => {
        const stop = jest.fn()
        jest.mocked(createAudioSource).mockReturnValueOnce({
            onData: jest.fn(),
            createTrack: () => ({ kind: 'audio', stop }) as unknown as MediaStreamTrack,
        })
        const core = await setup({ sampleRate: 48000, synthesize: async () => pcm() })
        const session = (core as any).sessions.get('a')
        core.onTerminate('a')
        expect(stop).toHaveBeenCalledTimes(1)
        expect(session.pc.ontrack).toBeNull()
        expect(session.pc.onconnectionstatechange).toBeNull()
        expect(session.source).toBeNull()
    })

    test('failed synthesis does not poison the per-call output queue', async () => {
        const synthesize = jest
            .fn<ITtsAdapter['synthesize']>()
            .mockRejectedValueOnce(new Error('TTS unavailable'))
            .mockResolvedValue(pcm())
        const core = await setup({ sampleRate: 48000, synthesize })
        const failed = expect(core.publishAudio('a', 'failed')).rejects.toThrow('TTS unavailable')
        await jest.advanceTimersByTimeAsync(0)
        await failed
        const next = core.publishAudio('a', 'retry')
        await jest.advanceTimersByTimeAsync(100)
        await next
        expect(lastSource().onData).toHaveBeenCalledTimes(3)
    })

    describe('graceful shutdown', () => {
        test('hangs up every call on Meta, cancels output and releases sessions', async () => {
            const gate = deferred<Buffer>()
            let signal: AbortSignal | undefined
            const core = await setup({
                sampleRate: 48000,
                synthesize: (_text, options) => {
                    signal = options?.signal
                    return gate.promise
                },
            })
            await core.onConnect(event('b'))
            const ended = jest.fn()
            core.on('call_ended', ended)
            const publishing = core.publishAudio('a', 'pending')
            await jest.advanceTimersByTimeAsync(0)

            await expect(core.shutdown()).resolves.toBe(2)
            await publishing

            expect(
                metaClientOf(core)
                    .end.mock.calls.map(([id]) => id)
                    .sort()
            ).toEqual(['a', 'b'])
            expect(signal?.aborted).toBe(true)
            expect(ended).toHaveBeenCalledTimes(2)
            expect(core.hasActiveCall('a') || core.hasActiveCall('b')).toBe(false)
            gate.resolve(pcm())
        })

        test('a Meta API that never answers cannot block shutdown', async () => {
            const core = await setup({ sampleRate: 48000, synthesize: async () => pcm() })
            metaClientOf(core).end.mockImplementation(() => new Promise(() => {}))
            const done = core.shutdown(500)
            await jest.advanceTimersByTimeAsync(500)
            await expect(done).resolves.toBe(1)
            expect(core.hasActiveCall('a')).toBe(false)
        })

        test('a rejected terminate is reported but the call is still released', async () => {
            const core = await setup({ sampleRate: 48000, synthesize: async () => pcm() })
            metaClientOf(core).end.mockRejectedValueOnce(new Error('HTTP 400'))
            const notices: Array<{ title: string }> = []
            core.on('notice', (notice) => notices.push(notice))
            await core.shutdown()
            expect(notices.some((n) => n.title.includes('terminate on shutdown failed'))).toBe(true)
            expect(core.hasActiveCall('a')).toBe(false)
        })

        test('calls arriving during shutdown are rejected, never accepted', async () => {
            const core = await setup({ sampleRate: 48000, synthesize: async () => pcm() })
            await core.shutdown()
            const client = metaClientOf(core)
            client.preAccept.mockClear()
            await core.onConnect(event('late'))
            expect(client.reject).toHaveBeenCalledWith('late')
            expect(client.preAccept).not.toHaveBeenCalled()
            expect(core.hasActiveCall('late')).toBe(false)
        })
    })
})

describe('audio processor (control de eco)', () => {
    const created: MetaCallCoreVendor[] = []
    afterEach(() => {
        for (const core of created.splice(0)) core.onTerminate('a')
    })

    test('recibe cada trama enviada y limpia las tramas entrantes antes del STT', async () => {
        const outbound: number[] = []
        const inbound: number[] = []
        const core = new MetaCallCoreVendor({
            sttAdapter: { transcribe: async () => 'texto' },
            ttsAdapter: { sampleRate: 48000, synthesize: async () => pcm(1000) },
            config: {
                ...config,
                audioProcessor: {
                    onOutboundFrame: (frame, rate) => outbound.push(rate, frame.length),
                    processInboundFrame: (frame) => {
                        inbound.push(frame.length)
                        return new Int16Array(frame.length) // silencio: simula eco cancelado
                    },
                },
            },
        })
        created.push(core)
        await core.onConnect(event('a'))
        await core.publishAudio('a', 'hola')
        await jest.advanceTimersByTimeAsync(50)
        expect(outbound.length).toBeGreaterThan(0)
        expect(outbound[0]).toBe(48000)

        // Una trama con voz entrante: el segmentador debe ver la versión LIMPIA (silencio),
        // así que no se detecta voz y no hay barge-in.
        const started = jest.fn()
        core.on('user_speech_started', started)
        speech()
        expect(inbound.length).toBeGreaterThan(0)
        expect(started).not.toHaveBeenCalled()
    })

    test('un procesador que falla no rompe el audio: se usa la trama original', async () => {
        const core = new MetaCallCoreVendor({
            sttAdapter: { transcribe: async () => 'texto' },
            ttsAdapter: { sampleRate: 48000, synthesize: async () => pcm() },
            config: {
                ...config,
                audioProcessor: {
                    processInboundFrame: () => {
                        throw new Error('DSP roto')
                    },
                },
            },
        })
        created.push(core)
        await core.onConnect(event('a'))
        const notices: Array<{ title: string }> = []
        core.on('notice', (notice) => notices.push(notice))
        const started = jest.fn()
        core.on('user_speech_started', started)
        speech()
        // Con la trama original, la voz se detecta: el audio no se pierde.
        expect(started).toHaveBeenCalled()
        expect(notices.filter((n) => n.title.includes('audio processor error'))).toHaveLength(1)
    })
})
