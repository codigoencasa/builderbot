/**
 * LAYER: Infrastructure
 * Contains: InworldSTTModel, InworldSTTAdapterOptions, InworldSTTAdapter
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [InworldSTTModel, InworldSTTAdapter]
 * GOAL: Own the "inworld" STT concern of the provider-voice package.
 */
import { pcmToWav } from '../../audio'
import type { ISttAdapter } from '../index'

/** STT models. */
export enum InworldSTTModel {
    Stt1 = 'inworld/inworld-stt-1',
}

export interface InworldSTTAdapterOptions {
    /** Base64 credential from the Inworld portal. Do not re-encode it. */
    apiKey: string
    /** Model to use. Default InworldSTTModel.Stt1. */
    model?: InworldSTTModel | string
    /** Context terms (names, jargon, acronyms) to improve recognition. Up to 100. */
    prompts?: string[]
    /** Regional deployment: 'us' | 'eu' | 'in'. Default 'us'. */
    region?: string
    /**
     * Milliseconds allowed per transcription. Utterances are transcribed in order, so a
     * request that never returns would leave the caller unheard for the rest of the call
     * with nothing in the logs. Default 10000.
     */
    timeoutMs?: number
}

const REGIONS: Record<string, string> = {
    us: 'https://api.inworld.ai',
    eu: 'https://api.eu.inworld.ai',
    in: 'https://api.in.inworld.ai',
}

interface InworldTranscribeResponse {
    transcription?: { transcript?: string }
}

/**
 * STT adapter for Inworld (synchronous, one utterance per request).
 *
 * Inworld sniffs the container, so raw PCM is wrapped in a WAV header before sending.
 * No extra npm deps: native `fetch`.
 *
 * @example
 * new InworldSTTAdapter({ apiKey: process.env.INWORLD_API_KEY! })
 */
export class InworldSTTAdapter implements ISttAdapter {
    private readonly apiKey: string
    private readonly model: string
    private readonly prompts?: string[]
    private readonly timeoutMs: number
    private readonly baseUrl: string

    constructor(options: InworldSTTAdapterOptions) {
        if (!options.apiKey) throw new Error('[InworldSTTAdapter] apiKey is required. Get it at inworld.ai')

        this.apiKey = options.apiKey
        this.model = options.model ?? InworldSTTModel.Stt1
        this.prompts = options.prompts
        this.timeoutMs = options.timeoutMs ?? 10000
        this.baseUrl = REGIONS[(options.region ?? 'us').toLowerCase()] ?? REGIONS.us
    }

    /**
     * Transcribe one utterance of raw PCM.
     *
     * @param pcm        Headerless 16-bit LE mono PCM.
     * @param sampleRate Sample rate of the PCM in Hz.
     * @param language   ISO-639-1 / BCP-47 hint (e.g. 'es', 'es-ES').
     * @returns Recognized text, trimmed. Empty string when nothing is heard.
     */
    async transcribe(pcm: Buffer, sampleRate: number, language?: string): Promise<string> {
        const res = await fetch(`${this.baseUrl}/stt/v1/transcribe`, {
            method: 'POST',
            // Without a timeout a hung request blocks the utterance queue forever.
            signal: AbortSignal.timeout(this.timeoutMs),
            headers: {
                Authorization: `Basic ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                transcribeConfig: {
                    modelId: this.model,
                    // Inworld only accepts containers (WAV/MP3/OGG/FLAC/M4A/WebM):
                    // raw PCM is wrapped in WAV.
                    audioEncoding: 'LINEAR16',
                    sampleRateHertz: sampleRate,
                    numberOfChannels: 1,
                    ...(language ? { language } : {}),
                    ...(this.prompts?.length ? { prompts: this.prompts } : {}),
                },
                audioData: {
                    content: pcmToWav(pcm, sampleRate).toString('base64'),
                },
            }),
        })

        if (!res.ok) {
            throw new Error(`[InworldSTTAdapter] ${res.status} ${res.statusText}: ${await res.text()}`)
        }

        const data = (await res.json()) as InworldTranscribeResponse
        return (data.transcription?.transcript ?? '').trim()
    }
}
