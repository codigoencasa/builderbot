/**
 * Adapter interfaces for pluggable STT and TTS backends.
 * Implement these interfaces to provide custom speech-to-text or
 * text-to-speech providers beyond the built-in OpenAI defaults.
 */

/**
 * Speech-to-text adapter interface.
 * Implementations receive raw PCM audio and return a transcribed string.
 */
export interface ISttAdapter {
    /**
     * Transcribe raw 16-bit LE mono PCM audio to text.
     * @param pcm     Raw 16-bit signed little-endian mono PCM buffer.
     * @param sampleRate Sample rate of the provided PCM in Hz.
     * @param language Optional BCP-47 / ISO-639-1 language hint (e.g. 'es').
     * @returns Recognized text, trimmed. Empty string when nothing is heard.
     */
    transcribe(pcm: Buffer, sampleRate: number, language?: string): Promise<string>
}

/**
 * Text-to-speech adapter interface.
 * Implementations return raw 16-bit LE mono PCM suitable for LiveKit AudioFrame.
 */
export interface ITtsAdapter {
    /**
     * Sample rate (Hz) of the PCM audio returned by {@link synthesize}.
     * Used to configure the LiveKit AudioSource correctly.
     */
    readonly sampleRate: number

    /**
     * Synthesize speech from text.
     * @param text The text to convert to speech.
     * @returns Raw 16-bit signed little-endian mono PCM buffer.
     */
    synthesize(text: string): Promise<Buffer>
}
