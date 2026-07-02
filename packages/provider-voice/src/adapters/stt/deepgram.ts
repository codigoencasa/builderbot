import { pcmToWav } from '../../audio'
import type { ISttAdapter } from '../index'

export enum DeepgramSTTModel {
    /** Nova 3 — latest, best accuracy (recommended) */
    Nova3 = 'nova-3',
    Nova2 = 'nova-2',
    Nova = 'nova',
    Enhanced = 'enhanced',
    Base = 'base',
}

export interface DeepgramSTTAdapterOptions {
    /** Deepgram API key. Get it at console.deepgram.com */
    apiKey: string
    /** Deepgram model to use. Default DeepgramSTTModel.Nova3 */
    model?: DeepgramSTTModel | string
}

interface DeepgramListenResponse {
    results: {
        channels: Array<{
            alternatives: Array<{
                transcript: string
            }>
        }>
    }
}

/**
 * STT adapter for Deepgram Nova.
 * Sends PCM wrapped in a WAV container to the Deepgram Listen endpoint.
 * No extra npm deps — uses native fetch.
 *
 * @example
 * new DeepgramSTTAdapter({ apiKey: 'dg-...', model: DeepgramSTTModel.Nova3 })
 */
export class DeepgramSTTAdapter implements ISttAdapter {
    private readonly apiKey: string
    private readonly model: string

    constructor(options: DeepgramSTTAdapterOptions) {
        if (!options.apiKey) throw new Error('[DeepgramSTTAdapter] apiKey is required. Get it at console.deepgram.com')

        this.apiKey = options.apiKey
        this.model = options.model ?? DeepgramSTTModel.Nova3
    }

    /**
     * Transcribe raw PCM audio using Deepgram Nova.
     * @param pcm       16-bit LE mono PCM buffer.
     * @param sampleRate Sample rate of the provided PCM in Hz.
     * @param language  Optional BCP-47 language hint (e.g. 'es', 'en-US').
     * @returns Recognized text, trimmed. Empty string when nothing is heard.
     */
    async transcribe(pcm: Buffer, sampleRate: number, language?: string): Promise<string> {
        const wav = pcmToWav(pcm, sampleRate)
        const langParam = language ? `&language=${encodeURIComponent(language)}` : ''
        const url = `https://api.deepgram.com/v1/listen?model=${encodeURIComponent(this.model)}&encoding=linear16&sample_rate=${sampleRate}${langParam}`

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Token ${this.apiKey}`,
                'Content-Type': 'audio/wav',
            },
            body: new Uint8Array(wav),
        })

        if (!response.ok) {
            const body = await response.text().catch(() => '')
            if (response.status === 401)
                throw new Error('[DeepgramSTTAdapter] Invalid API key. Check console.deepgram.com')
            throw new Error(`[DeepgramSTTAdapter] HTTP ${response.status}: ${body}`)
        }

        const data = (await response.json()) as DeepgramListenResponse
        return (data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '').trim()
    }
}
