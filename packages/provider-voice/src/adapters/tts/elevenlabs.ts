import type { ITtsAdapter } from '../index'

export enum ElevenLabsModel {
    TurboV2_5 = 'eleven_turbo_v2_5',
    MultilingualV2 = 'eleven_multilingual_v2',
    FlashV2_5 = 'eleven_flash_v2_5',
}

export interface ElevenLabsTTSAdapterOptions {
    /** ElevenLabs API key (xi-api-key). Get it at elevenlabs.io/app/settings/api-keys */
    apiKey: string
    /** Voice ID. Find yours at elevenlabs.io/voice-library */
    voiceId: string
    /** Model to use. Default ElevenLabsModel.TurboV2_5 */
    model?: ElevenLabsModel | string
    /** Stability (0-1). Higher = more consistent, lower = more expressive. Default 0.5 */
    stability?: number
    /** Similarity boost (0-1). Default 0.75 */
    similarityBoost?: number
}

/**
 * TTS adapter for ElevenLabs.
 * Returns 24 kHz 16-bit LE mono PCM via the `pcm_24000` output format.
 * No extra npm deps — uses native fetch.
 *
 * @example
 * new ElevenLabsTTSAdapter({ apiKey: 'xi-...', voiceId: 'your-voice-id' })
 */
export class ElevenLabsTTSAdapter implements ITtsAdapter {
    readonly sampleRate = 24000

    private readonly apiKey: string
    private readonly voiceId: string
    private readonly model: string
    private readonly stability: number
    private readonly similarityBoost: number

    constructor(options: ElevenLabsTTSAdapterOptions) {
        if (!options.apiKey)
            throw new Error('[ElevenLabsTTSAdapter] apiKey is required. Get it at elevenlabs.io/app/settings/api-keys')
        if (!options.voiceId)
            throw new Error(
                '[ElevenLabsTTSAdapter] voiceId is required. Use ElevenLabsVoice enum or visit elevenlabs.io/voice-library'
            )

        this.apiKey = options.apiKey
        this.voiceId = options.voiceId
        this.model = options.model ?? ElevenLabsModel.TurboV2_5
        this.stability = options.stability ?? 0.5
        this.similarityBoost = options.similarityBoost ?? 0.75
    }

    async synthesize(text: string): Promise<Buffer> {
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(this.voiceId)}/stream?output_format=pcm_24000`

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'xi-api-key': this.apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text,
                model_id: this.model,
                voice_settings: {
                    stability: this.stability,
                    similarity_boost: this.similarityBoost,
                },
            }),
        })

        if (!response.ok) {
            const body = await response.text().catch(() => '')
            if (response.status === 401)
                throw new Error('[ElevenLabsTTSAdapter] Invalid API key. Check elevenlabs.io/app/settings/api-keys')
            if (response.status === 404)
                throw new Error(
                    `[ElevenLabsTTSAdapter] Voice not found: "${this.voiceId}". Use ElevenLabsVoice enum or check elevenlabs.io/voice-library`
                )
            throw new Error(`[ElevenLabsTTSAdapter] HTTP ${response.status}: ${body}`)
        }

        return Buffer.from(await response.arrayBuffer())
    }
}
