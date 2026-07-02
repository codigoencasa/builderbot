import type { ITtsAdapter } from '../index'

export enum CartesiaModel {
    Sonic3 = 'sonic-3',
    SonicTurbo = 'sonic-turbo',
    Sonic2 = 'sonic-2',
}

export interface CartesiaTTSAdapterOptions {
    /** Cartesia API key. Get it at play.cartesia.ai/keys */
    apiKey: string
    /** Voice ID (UUID). Find yours at play.cartesia.ai/voices */
    voiceId: string
    /** Model to use. Default CartesiaModel.Sonic3 */
    model?: CartesiaModel | string
}

/**
 * TTS adapter for Cartesia (lowest latency — ~90ms TTFB).
 * Returns 24 kHz 16-bit LE mono PCM.
 * No extra npm deps — uses native fetch.
 *
 * @example
 * new CartesiaTTSAdapter({ apiKey: 'sk-cart-...', voiceId: 'your-voice-uuid' })
 */
export class CartesiaTTSAdapter implements ITtsAdapter {
    readonly sampleRate = 24000

    private readonly apiKey: string
    private readonly voiceId: string
    private readonly model: string

    constructor(options: CartesiaTTSAdapterOptions) {
        if (!options.apiKey) throw new Error('[CartesiaTTSAdapter] apiKey is required. Get it at play.cartesia.ai/keys')
        if (!options.voiceId)
            throw new Error(
                '[CartesiaTTSAdapter] voiceId is required. Use CartesiaVoice enum or visit play.cartesia.ai/voices'
            )

        this.apiKey = options.apiKey
        this.voiceId = options.voiceId
        this.model = options.model ?? CartesiaModel.Sonic3
    }

    async synthesize(text: string): Promise<Buffer> {
        const response = await fetch('https://api.cartesia.ai/tts/bytes', {
            method: 'POST',
            headers: {
                'X-API-Key': this.apiKey,
                'Cartesia-Version': '2024-06-10',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model_id: this.model,
                transcript: text,
                voice: { mode: 'id', id: this.voiceId },
                output_format: {
                    container: 'raw',
                    encoding: 'pcm_s16le',
                    sample_rate: this.sampleRate,
                },
            }),
        })

        if (!response.ok) {
            const body = await response.text().catch(() => '')
            if (response.status === 401)
                throw new Error('[CartesiaTTSAdapter] Invalid API key. Check play.cartesia.ai/keys')
            if (response.status === 422)
                throw new Error(
                    `[CartesiaTTSAdapter] Invalid voiceId: "${this.voiceId}". Find valid IDs at play.cartesia.ai/voices`
                )
            throw new Error(`[CartesiaTTSAdapter] HTTP ${response.status}: ${body}`)
        }

        return Buffer.from(await response.arrayBuffer())
    }
}
