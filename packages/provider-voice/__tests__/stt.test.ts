import { describe, expect, jest, test } from '@jest/globals'
import type OpenAI from 'openai'

import { transcribe } from '../src/stt'

describe('#transcribe', () => {
    test('wraps PCM as WAV, calls Whisper and returns trimmed text', async () => {
        const create = jest.fn(async (_body: { model: string; language?: string }) => ({ text: '  hola mundo  ' }))
        const client = {
            audio: { transcriptions: { create } },
        } as unknown as OpenAI

        const pcm = Buffer.from(new Int16Array([1, -1, 2, -2]).buffer)
        const result = await transcribe(client, pcm, { sampleRate: 16000, language: 'es' })

        expect(result).toBe('hola mundo')
        expect(create).toHaveBeenCalledTimes(1)
        const arg = create.mock.calls[0][0]
        expect(arg.model).toBe('gpt-4o-mini-transcribe')
        expect(arg.language).toBe('es')
    })

    test('returns empty string when Whisper yields no text', async () => {
        const create = jest.fn(async (_body: { model: string }) => ({ text: undefined }))
        const client = { audio: { transcriptions: { create } } } as unknown as OpenAI

        const result = await transcribe(client, Buffer.alloc(8), { sampleRate: 16000 })
        expect(result).toBe('')
    })
})
