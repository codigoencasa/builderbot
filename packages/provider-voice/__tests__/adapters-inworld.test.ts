import { afterEach, describe, expect, jest, test } from '@jest/globals'

import { startMockSocketServer } from '../__mock__/mock-ws-server'
import type { MockSocketServer } from '../__mock__/mock-ws-server'
import { InworldSTTAdapter } from '../src/adapters/stt/inworld'
import { InworldTTSAdapter, splitSentences } from '../src/adapters/tts/inworld'

const API_KEY = 'test-credential'

const waitFor = async (predicate: () => boolean, what: string, timeoutMs = 3000): Promise<void> => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        if (predicate()) return
        await new Promise((resolve) => setTimeout(resolve, 5))
    }
    throw new Error(`waitFor: timed out waiting for ${what}`)
}

const collect = async (iterable: AsyncIterable<Buffer>): Promise<Buffer[]> => {
    const out: Buffer[] = []
    for await (const chunk of iterable) out.push(chunk)
    return out
}

const pcmChunk = (value: number, samples = 480) =>
    Buffer.from(new Int16Array(samples).fill(value).buffer).toString('base64')

const makeTts = (server: MockSocketServer, extra: Record<string, unknown> = {}) =>
    new InworldTTSAdapter({
        apiKey: API_KEY,
        voiceId: 'Sofia',
        model: 'inworld-tts-2-flash',
        sampleRate: 48000,
        wsBaseUrl: server.url,
        ...extra,
    })

describe('InworldTTSAdapter (WebSocket streaming)', () => {
    let server: MockSocketServer | null = null
    const start = async () => {
        server = await startMockSocketServer()
        return server
    }
    afterEach(async () => {
        await server?.stop()
        server = null
    })

    test('sends create, send_text and close_context and yields PCM as it arrives', async () => {
        const mock = await start()
        const adapter = makeTts(mock)

        const pending = collect(adapter.synthesizeStream('Hola, ¿qué tal?', { callId: 'call-1' }))
        await waitFor(() => mock.received().length >= 3, 'client messages')

        const [create, sendText, close] = mock.received() as Array<Record<string, any>>
        expect(mock.headers()['authorization']).toBe(`Basic ${API_KEY}`)
        expect(create.create.voice_id).toBe('Sofia')
        expect(create.create.model_id).toBe('inworld-tts-2-flash')
        expect(create.create.audio_config).toEqual({
            audio_encoding: 'PCM',
            sample_rate_hertz: 48000,
            bit_rate: 32000,
        })
        expect(String(create.context_id)).toMatch(/^ctx-call-1-/)
        expect(sendText.send_text.text).toBe('Hola, ¿qué tal?')
        expect(sendText.send_text.flush_context).toEqual({})
        expect(close.close_context).toEqual({})
        expect(sendText.context_id).toBe(create.context_id)

        mock.send({ result: { audioChunk: { audioContent: pcmChunk(111) } } })
        mock.send({ result: { audioChunk: { audioContent: pcmChunk(222) } } })
        mock.send({ result: { contextClosed: {} } })

        const chunks = await pending
        expect(chunks).toHaveLength(2)
        expect(new Int16Array(chunks[0].buffer, chunks[0].byteOffset, 1)[0]).toBe(111)
        expect(new Int16Array(chunks[1].buffer, chunks[1].byteOffset, 1)[0]).toBe(222)
    })

    test('sends one message per sentence with flush', async () => {
        const mock = await start()
        const adapter = makeTts(mock)
        const pending = collect(adapter.synthesizeStream('Primera frase. Segunda frase.', {}))
        await waitFor(() => mock.received().length >= 4, 'one send_text per sentence')
        const texts = (mock.received() as Array<Record<string, any>>)
            .filter((message) => message.send_text)
            .map((message) => message.send_text.text)
        expect(texts).toEqual(['Primera frase.', 'Segunda frase.'])
        mock.send({ result: { contextClosed: {} } })
        await pending
    })

    test('propagates a server error', async () => {
        const mock = await start()
        const adapter = makeTts(mock)
        const pending = collect(adapter.synthesizeStream('Hola.', {}))
        await waitFor(() => mock.received().length >= 3, 'client messages')
        mock.send({ error: { message: 'unknown voice' } })
        await expect(pending).rejects.toThrow(/unknown voice/)
    })

    test('cancelling ends the stream', async () => {
        const mock = await start()
        const adapter = makeTts(mock)
        const controller = new AbortController()
        const stream = adapter.synthesizeStream('Una frase larga.', { signal: controller.signal })
        const iterator = stream[Symbol.asyncIterator]()
        // An async generator does not run until the first next().
        const firstChunk = iterator.next()
        await waitFor(() => mock.received().length >= 3, 'client messages')
        mock.send({ result: { audioChunk: { audioContent: pcmChunk(1) } } })
        expect((await firstChunk).done).toBe(false)

        controller.abort()
        expect((await iterator.next()).done).toBe(true)
    })

    test('a clean close without audio ends the stream empty', async () => {
        const mock = await start()
        const adapter = makeTts(mock)
        const pending = collect(adapter.synthesizeStream('Hola.', {}))
        await waitFor(() => mock.received().length >= 3, 'client messages')
        mock.close()
        expect(await pending).toEqual([])
    })

    test('a dropped connection is reported instead of silently truncating', async () => {
        const mock = await start()
        const adapter = makeTts(mock)
        const pending = collect(adapter.synthesizeStream('Hola.', {}))
        await waitFor(() => mock.received().length >= 3, 'client messages')
        mock.send({ result: { audioChunk: { audioContent: pcmChunk(5) } } })
        mock.destroy()
        await expect(pending).rejects.toThrow(/interrupted|could not open/)
    })

    test('empty text opens no connection', async () => {
        const mock = await start()
        const adapter = makeTts(mock)
        expect(await collect(adapter.synthesizeStream('   ', {}))).toEqual([])
        expect(mock.received()).toEqual([])
    })

    test('a socket that never answers fails by timeout instead of hanging the turn', async () => {
        const mock = await start()
        const adapter = makeTts(mock, { streamTimeoutMs: 150 })
        await expect(collect(adapter.synthesizeStream('Hola.', {}))).rejects.toThrow(/did not respond|stopped sending/)
    })
})

describe('InworldTTSAdapter (HTTP)', () => {
    const originalFetch = globalThis.fetch
    afterEach(() => {
        globalThis.fetch = originalFetch
    })

    test('requests PCM and returns the audio, sending the configured options', async () => {
        const audio = Buffer.from(new Int16Array([7, 8, 9]).buffer)
        const fetchMock = jest.fn<(url: string, init: RequestInit) => Promise<Response>>(
            async () => new Response(JSON.stringify({ audioContent: audio.toString('base64') }), { status: 200 })
        )
        globalThis.fetch = fetchMock as unknown as typeof fetch

        const adapter = new InworldTTSAdapter({
            apiKey: API_KEY,
            voiceId: 'Ashley',
            model: 'inworld-tts-2',
            sampleRate: 24000,
            language: 'es-MX',
            normalization: 'OFF',
            deliveryMode: 'STABLE',
        })
        const result = await adapter.synthesize('Hola')

        expect(result).toEqual(audio)
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('https://api.inworld.ai/tts/v1/voice')
        const body = JSON.parse(String(init.body))
        expect(body).toMatchObject({
            text: 'Hola',
            voiceId: 'Ashley',
            modelId: 'inworld-tts-2',
            applyTextNormalization: 'OFF',
            deliveryMode: 'STABLE',
            language: 'es-MX',
        })
        expect(body.audioConfig).toEqual({ audioEncoding: 'PCM', sampleRateHertz: 24000 })
        expect(init.headers).toMatchObject({ Authorization: `Basic ${API_KEY}` })
    })

    test('splits long text into several requests', async () => {
        const fetchMock = jest.fn<(url: string, init: RequestInit) => Promise<Response>>(
            async () =>
                new Response(JSON.stringify({ audioContent: Buffer.alloc(4).toString('base64') }), { status: 200 })
        )
        globalThis.fetch = fetchMock as unknown as typeof fetch

        const adapter = new InworldTTSAdapter({ apiKey: API_KEY, voiceId: 'Ashley' })
        await adapter.synthesize('Frase larga. '.repeat(300))

        expect(fetchMock.mock.calls.length).toBeGreaterThan(1)
        const total = fetchMock.mock.calls
            .map(([, init]) => JSON.parse(String(init.body)).text.length)
            .reduce((sum, length) => sum + length, 0)
        expect(total).toBeGreaterThan(3000)
    })

    test('empty text costs no request', async () => {
        const fetchMock = jest.fn()
        globalThis.fetch = fetchMock as unknown as typeof fetch
        const adapter = new InworldTTSAdapter({ apiKey: API_KEY, voiceId: 'Ashley' })
        expect(await adapter.synthesize('   ')).toEqual(Buffer.alloc(0))
        expect(fetchMock).not.toHaveBeenCalled()
    })

    test('a failing response surfaces the status and body', async () => {
        globalThis.fetch = jest.fn(async () => new Response('nope', { status: 429 })) as unknown as typeof fetch
        const adapter = new InworldTTSAdapter({ apiKey: API_KEY, voiceId: 'Ashley' })
        await expect(adapter.synthesize('Hola')).rejects.toThrow(/429/)
    })

    test('requires apiKey and voiceId', () => {
        expect(() => new InworldTTSAdapter({ apiKey: '', voiceId: 'x' })).toThrow(/apiKey/)
        expect(() => new InworldTTSAdapter({ apiKey: 'k', voiceId: '' })).toThrow(/voiceId/)
    })
})

describe('InworldSTTAdapter', () => {
    const originalFetch = globalThis.fetch
    afterEach(() => {
        globalThis.fetch = originalFetch
    })

    test('wraps PCM as WAV and returns the trimmed transcript', async () => {
        const fetchMock = jest.fn<(url: string, init: RequestInit) => Promise<Response>>(
            async () =>
                new Response(JSON.stringify({ transcription: { transcript: '  hola mundo  ' } }), { status: 200 })
        )
        globalThis.fetch = fetchMock as unknown as typeof fetch

        const adapter = new InworldSTTAdapter({ apiKey: API_KEY, prompts: ['BuilderBot'] })
        const text = await adapter.transcribe(Buffer.alloc(960), 16000, 'es')

        expect(text).toBe('hola mundo')
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('https://api.inworld.ai/stt/v1/transcribe')
        expect(init.signal).toBeInstanceOf(AbortSignal)
        const body = JSON.parse(String(init.body))
        expect(body.transcribeConfig).toMatchObject({
            modelId: 'inworld/inworld-stt-1',
            audioEncoding: 'LINEAR16',
            sampleRateHertz: 16000,
            numberOfChannels: 1,
            language: 'es',
            prompts: ['BuilderBot'],
        })
        // The audio must be a WAV container, not raw PCM.
        const audio = Buffer.from(body.audioData.content, 'base64')
        expect(audio.subarray(0, 4).toString()).toBe('RIFF')
    })

    test('returns an empty string when nothing was heard', async () => {
        globalThis.fetch = jest.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch
        const adapter = new InworldSTTAdapter({ apiKey: API_KEY })
        expect(await adapter.transcribe(Buffer.alloc(960), 16000)).toBe('')
    })

    test('a failing response surfaces the status', async () => {
        globalThis.fetch = jest.fn(async () => new Response('bad audio', { status: 400 })) as unknown as typeof fetch
        const adapter = new InworldSTTAdapter({ apiKey: API_KEY })
        await expect(adapter.transcribe(Buffer.alloc(960), 16000)).rejects.toThrow(/400/)
    })

    test('requires apiKey', () => {
        expect(() => new InworldSTTAdapter({ apiKey: '' })).toThrow(/apiKey/)
    })
})

describe('splitSentences', () => {
    test('keeps the whole text and respects ellipsis', () => {
        expect(splitSentences('Vale, claro que sí... ¿Seguimos?')).toEqual(['Vale, claro que sí...', '¿Seguimos?'])
        expect(splitSentences('Sin puntuación final')).toEqual(['Sin puntuación final'])
    })
})
