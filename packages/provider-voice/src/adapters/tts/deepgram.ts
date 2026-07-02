import type { ITtsAdapter } from '../index'

export enum DeepgramTTSModel {
    /** Aura 2 — latest generation, highest quality */
    Aura2EnUs = 'aura-2-en-us',
    Aura2EnUk = 'aura-2-en-uk',
    /** Aura 1 voices */
    AsteraEn = 'aura-asteria-en',
    LunaEn = 'aura-luna-en',
    StellaEn = 'aura-stella-en',
    AthenaEn = 'aura-athena-en',
    HeraEn = 'aura-hera-en',
    OrionEn = 'aura-orion-en',
    AreasEn = 'aura-arcas-en',
    PerseusEn = 'aura-perseus-en',
    OrpheusEn = 'aura-orpheus-en',
    HeliosEn = 'aura-helios-en',
    ZeusEn = 'aura-zeus-en',
}

export interface DeepgramTTSAdapterOptions {
    /** Deepgram API key. Get it at console.deepgram.com */
    apiKey: string
    /** Deepgram Aura model. Default DeepgramTTSModel.Aura2EnUs */
    model?: DeepgramTTSModel | string
}

/**
 * TTS adapter for Deepgram Aura.
 * Returns 24 kHz 16-bit LE mono PCM.
 * No extra npm deps — uses native fetch.
 *
 * @example
 * new DeepgramTTSAdapter({ apiKey: 'dg-...', model: DeepgramTTSModel.Aura2EnUs })
 */
export class DeepgramTTSAdapter implements ITtsAdapter {
    readonly sampleRate = 24000

    private readonly apiKey: string
    private readonly model: string

    constructor(options: DeepgramTTSAdapterOptions) {
        if (!options.apiKey) throw new Error('[DeepgramTTSAdapter] apiKey is required. Get it at console.deepgram.com')

        this.apiKey = options.apiKey
        this.model = options.model ?? DeepgramTTSModel.Aura2EnUs
    }

    async synthesize(text: string): Promise<Buffer> {
        const url = `https://api.deepgram.io/v1/speak?model=${encodeURIComponent(this.model)}&encoding=linear16&sample_rate=${this.sampleRate}`

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Token ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
        })

        if (!response.ok) {
            const body = await response.text().catch(() => '')
            if (response.status === 401)
                throw new Error('[DeepgramTTSAdapter] Invalid API key. Check console.deepgram.com')
            if (response.status === 400)
                throw new Error(
                    `[DeepgramTTSAdapter] Bad request — check model name: "${this.model}". Valid models: DeepgramTTSModel enum`
                )
            throw new Error(`[DeepgramTTSAdapter] HTTP ${response.status}: ${body}`)
        }

        return Buffer.from(await response.arrayBuffer())
    }
}
