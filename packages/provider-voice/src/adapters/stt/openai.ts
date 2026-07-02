import OpenAI from 'openai'

import { transcribe } from '../../stt'
import type { ISttAdapter } from '../index'

export interface OpenAISTTAdapterOptions {
    /** OpenAI API key. Get it at platform.openai.com/api-keys */
    apiKey: string
    /** Transcription model. Default 'gpt-4o-mini-transcribe' */
    model?: string
}

/**
 * STT adapter for OpenAI (Whisper / gpt-4o-transcribe).
 * Default adapter used when no custom STT adapter is provided.
 *
 * @example
 * new OpenAISTTAdapter({ apiKey: 'sk-...', model: 'gpt-4o-mini-transcribe' })
 */
export class OpenAISTTAdapter implements ISttAdapter {
    private readonly client: OpenAI
    private readonly model: string | undefined

    constructor(options: OpenAISTTAdapterOptions) {
        if (!options.apiKey)
            throw new Error('[OpenAISTTAdapter] apiKey is required. Get it at platform.openai.com/api-keys')
        this.client = new OpenAI({ apiKey: options.apiKey })
        this.model = options.model
    }

    /**
     * Transcribe raw PCM audio using OpenAI Whisper / gpt-4o-transcribe.
     * @param pcm        16-bit LE mono PCM buffer.
     * @param sampleRate Sample rate of the provided PCM in Hz.
     * @param language   Optional ISO-639-1 language hint (e.g. 'es', 'en').
     * @returns Recognized text, trimmed. Empty string when nothing is heard.
     */
    async transcribe(pcm: Buffer, sampleRate: number, language?: string): Promise<string> {
        return transcribe(this.client, pcm, { model: this.model, sampleRate, language })
    }
}
