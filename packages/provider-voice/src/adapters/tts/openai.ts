import OpenAI from 'openai'

import { synthesize, TTS_SAMPLE_RATE } from '../../tts'
import type { ITtsAdapter } from '../index'

export interface OpenAITTSAdapterOptions {
    /** OpenAI API key. Get it at platform.openai.com/api-keys */
    apiKey: string
    /** TTS model. Default 'gpt-4o-mini-tts' */
    model?: string
    /** Voice name. Default 'alloy' */
    voice?: string
}

/**
 * TTS adapter for OpenAI (gpt-4o-mini-tts / gpt-4o-tts).
 * Default adapter used when no custom TTS adapter is provided.
 * Returns 24 kHz 16-bit LE mono PCM.
 *
 * @example
 * new OpenAITTSAdapter({ apiKey: 'sk-...', voice: 'nova' })
 */
export class OpenAITTSAdapter implements ITtsAdapter {
    readonly sampleRate: number = TTS_SAMPLE_RATE

    private readonly client: OpenAI
    private readonly model: string | undefined
    private readonly voice: string | undefined

    constructor(options: OpenAITTSAdapterOptions) {
        if (!options.apiKey)
            throw new Error('[OpenAITTSAdapter] apiKey is required. Get it at platform.openai.com/api-keys')
        this.client = new OpenAI({ apiKey: options.apiKey })
        this.model = options.model
        this.voice = options.voice
    }

    /**
     * Synthesize speech from text using OpenAI TTS.
     * @param text Text to convert to speech.
     * @returns Raw 24 kHz 16-bit LE mono PCM buffer.
     */
    async synthesize(text: string): Promise<Buffer> {
        return synthesize(this.client, text, { model: this.model, voice: this.voice })
    }
}
