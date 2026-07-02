import OpenAI, { toFile } from 'openai'

import { pcmToWav } from './audio'

export interface TranscribeOptions {
    /** Whisper model. Default 'whisper-1'. */
    model?: string
    /** Language hint (ISO-639-1), e.g. 'es'. */
    language?: string
    /** Sample rate of the provided PCM. */
    sampleRate: number
}

/**
 * Transcribe a raw 16-bit PCM (mono) utterance using OpenAI Whisper.
 * Wraps the PCM into a WAV container before upload.
 *
 * @returns The recognized text, trimmed. Empty string when nothing is heard.
 */
export const transcribe = async (client: OpenAI, pcm: Buffer, options: TranscribeOptions): Promise<string> => {
    const wav = pcmToWav(pcm, options.sampleRate)
    const file = await toFile(wav, 'utterance.wav', { type: 'audio/wav' })

    const result = await client.audio.transcriptions.create({
        file,
        model: options.model ?? 'gpt-4o-mini-transcribe',
        language: options.language,
    })

    return (result.text ?? '').trim()
}
