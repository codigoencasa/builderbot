import { describe, expect, jest, test } from '@jest/globals'
import type OpenAI from 'openai'

import { synthesize, TTS_SAMPLE_RATE } from '../src/tts'

describe('#synthesize', () => {
    test('requests PCM and returns the audio as a Buffer', async () => {
        const payload = new Uint8Array([1, 2, 3, 4, 5])
        const create = jest.fn(async (_body: { input: string; voice: string; response_format: string }) => ({
            arrayBuffer: async () => payload.buffer,
        }))
        const client = { audio: { speech: { create } } } as unknown as OpenAI

        const result = await synthesize(client, 'hola', { voice: 'verse' })

        expect(Buffer.isBuffer(result)).toBe(true)
        expect(Array.from(result)).toEqual([1, 2, 3, 4, 5])

        const arg = create.mock.calls[0][0]
        expect(arg.input).toBe('hola')
        expect(arg.voice).toBe('verse')
        expect(arg.response_format).toBe('pcm')
    })

    test('exposes the 24kHz output sample rate', () => {
        expect(TTS_SAMPLE_RATE).toBe(24000)
    })
})
