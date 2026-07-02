import OpenAI from 'openai'

/** Sample rate of OpenAI TTS PCM output (24 kHz, 16-bit, mono). */
export const TTS_SAMPLE_RATE = 24000

export interface SynthesizeOptions {
    /** OpenAI TTS model. Default 'gpt-4o-mini-tts'. */
    model?: string
    /** Voice name. Default 'alloy'. */
    voice?: string
}

/**
 * Synthesize speech from text using OpenAI TTS, returning raw 16-bit PCM
 * (mono, {@link TTS_SAMPLE_RATE}) ready to publish to a LiveKit AudioSource.
 */
export const synthesize = async (client: OpenAI, text: string, options: SynthesizeOptions = {}): Promise<Buffer> => {
    const response = await client.audio.speech.create({
        model: options.model ?? 'gpt-4o-mini-tts',
        voice: options.voice ?? 'alloy',
        input: text,
        response_format: 'pcm',
    })

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
}
