/**
 * Pure audio helpers for the voice provider. No external SDK dependencies so
 * they can be unit-tested in isolation.
 *
 * Convention: PCM is 16-bit signed little-endian, mono unless stated otherwise.
 */

/**
 * Wrap raw 16-bit PCM into a WAV container so it can be sent to OpenAI Whisper.
 * @param pcm 16-bit signed little-endian PCM samples.
 * @param sampleRate Sample rate in Hz.
 * @param channels Channel count (default 1).
 */
export const pcmToWav = (pcm: Buffer, sampleRate: number, channels = 1): Buffer => {
    const bitsPerSample = 16
    const byteRate = (sampleRate * channels * bitsPerSample) / 8
    const blockAlign = (channels * bitsPerSample) / 8
    const header = Buffer.alloc(44)

    header.write('RIFF', 0)
    header.writeUInt32LE(36 + pcm.length, 4)
    header.write('WAVE', 8)
    header.write('fmt ', 12)
    header.writeUInt32LE(16, 16) // PCM chunk size
    header.writeUInt16LE(1, 20) // audio format = PCM
    header.writeUInt16LE(channels, 22)
    header.writeUInt32LE(sampleRate, 24)
    header.writeUInt32LE(byteRate, 28)
    header.writeUInt16LE(blockAlign, 32)
    header.writeUInt16LE(bitsPerSample, 34)
    header.write('data', 36)
    header.writeUInt32LE(pcm.length, 40)

    return Buffer.concat([header, pcm])
}

/**
 * Normalized root-mean-square amplitude (0..1) of a 16-bit PCM frame.
 * Used to decide whether a frame is silence.
 */
export const frameRms = (samples: Int16Array): number => {
    if (samples.length === 0) return 0
    let sumSquares = 0
    for (let i = 0; i < samples.length; i++) {
        const normalized = samples[i] / 32768
        sumSquares += normalized * normalized
    }
    return Math.sqrt(sumSquares / samples.length)
}

/**
 * Convert an Int16Array of PCM samples into a little-endian Buffer.
 */
export const int16ToBuffer = (samples: Int16Array): Buffer => {
    const buffer = Buffer.alloc(samples.length * 2)
    for (let i = 0; i < samples.length; i++) {
        buffer.writeInt16LE(samples[i], i * 2)
    }
    return buffer
}

/**
 * Convert a little-endian 16-bit PCM Buffer into an Int16Array.
 */
export const bufferToInt16 = (buffer: Buffer): Int16Array => {
    const samples = new Int16Array(Math.floor(buffer.length / 2))
    for (let i = 0; i < samples.length; i++) {
        samples[i] = buffer.readInt16LE(i * 2)
    }
    return samples
}

/**
 * Linear resampling of a mono 16-bit PCM stream. Good enough to match the TTS
 * output rate (24 kHz) to a different LiveKit AudioSource rate when needed.
 */
export const resamplePcm = (samples: Int16Array, fromRate: number, toRate: number): Int16Array => {
    if (fromRate === toRate) return samples
    const ratio = toRate / fromRate
    const outLength = Math.floor(samples.length * ratio)
    const out = new Int16Array(outLength)
    for (let i = 0; i < outLength; i++) {
        const srcPos = i / ratio
        const left = Math.floor(srcPos)
        const right = Math.min(left + 1, samples.length - 1)
        const frac = srcPos - left
        out[i] = Math.round(samples[left] * (1 - frac) + samples[right] * frac)
    }
    return out
}

/**
 * Split a PCM Int16Array into fixed-size frames (per channel) suitable for
 * LiveKit's AudioSource.captureFrame.
 *
 * @param pad When true (default), the last frame is zero-padded to
 * `samplesPerFrame`. When false, the last frame keeps its real (shorter)
 * length — avoids the audible click a zero tail produces at the end of speech.
 */
export const chunkPcm = (samples: Int16Array, samplesPerFrame: number, pad = true): Int16Array[] => {
    if (samplesPerFrame <= 0) throw new Error('samplesPerFrame must be > 0')
    const frames: Int16Array[] = []
    for (let offset = 0; offset < samples.length; offset += samplesPerFrame) {
        const slice = samples.subarray(offset, offset + samplesPerFrame)
        if (slice.length === samplesPerFrame || !pad) {
            frames.push(slice)
        } else {
            const padded = new Int16Array(samplesPerFrame)
            padded.set(slice)
            frames.push(padded)
        }
    }
    return frames
}

export interface SilenceSegmenterOptions {
    sampleRate: number
    /** Milliseconds of continuous silence that close an utterance. */
    silenceMs: number
    /** RMS threshold (0..1) below which a frame is silence. */
    silenceThreshold: number
    /** Minimum utterance length (ms) to emit; shorter blips are discarded. */
    minUtteranceMs?: number
    /**
     * Maximum utterance length (ms) before a force-cut, even without trailing
     * silence. Bounds memory and keeps Whisper uploads under its 25MB limit
     * when a speaker never pauses (continuous speech or noisy line). Default 20000.
     */
    maxUtteranceMs?: number
}

/**
 * Accumulates audio frames and detects utterance boundaries by silence.
 *
 * Feed frames as they arrive with {@link push}; when enough trailing silence
 * follows speech, it returns the buffered utterance (speech only) as a Buffer,
 * otherwise null. Stateful and single-room scoped.
 */
export class SilenceSegmenter {
    private readonly sampleRate: number
    private readonly silenceThreshold: number
    private readonly silenceSamples: number
    private readonly minUtteranceSamples: number
    private readonly maxUtteranceSamples: number

    private buffered: Int16Array[] = []
    private bufferedSamples = 0
    private trailingSilenceSamples = 0
    private hasSpeech = false

    constructor(opts: SilenceSegmenterOptions) {
        this.sampleRate = opts.sampleRate
        this.silenceThreshold = opts.silenceThreshold
        this.silenceSamples = Math.round((opts.silenceMs / 1000) * opts.sampleRate)
        this.minUtteranceSamples = Math.round(((opts.minUtteranceMs ?? 300) / 1000) * opts.sampleRate)
        this.maxUtteranceSamples = Math.round(((opts.maxUtteranceMs ?? 20000) / 1000) * opts.sampleRate)
    }

    /**
     * Push one frame. Returns the completed utterance PCM Buffer when an
     * utterance just ended (trailing silence reached, or the max length is hit),
     * otherwise null.
     */
    push(samples: Int16Array): Buffer | null {
        const isSilent = frameRms(samples) < this.silenceThreshold

        // Drop leading silence entirely so utterances start at speech.
        if (!this.hasSpeech && isSilent) {
            return null
        }

        // Copy: the caller may hand us a view into a buffer the audio stream
        // reuses across frames. Retaining a reference would corrupt the buffer.
        this.buffered.push(samples.slice())
        this.bufferedSamples += samples.length

        if (isSilent) {
            this.trailingSilenceSamples += samples.length
        } else {
            this.hasSpeech = true
            this.trailingSilenceSamples = 0
        }

        if (this.hasSpeech && this.trailingSilenceSamples >= this.silenceSamples) {
            return this.flush()
        }

        // Force-cut a runaway utterance to bound memory and Whisper upload size.
        if (this.bufferedSamples >= this.maxUtteranceSamples) {
            return this.flush()
        }
        return null
    }

    /**
     * Force-close the current utterance (e.g. participant left). Returns the
     * buffered PCM Buffer, or null if there was no usable speech.
     */
    flush(): Buffer | null {
        const speechSamples = this.bufferedSamples - this.trailingSilenceSamples
        const collected = this.buffered
        this.reset()

        if (!this.hasSpeechCollected(speechSamples)) return null
        return int16ToBuffer(concatInt16(collected))
    }

    private hasSpeechCollected(speechSamples: number): boolean {
        return speechSamples >= this.minUtteranceSamples
    }

    private reset(): void {
        this.buffered = []
        this.bufferedSamples = 0
        this.trailingSilenceSamples = 0
        this.hasSpeech = false
    }
}

const concatInt16 = (chunks: Int16Array[]): Int16Array => {
    const total = chunks.reduce((sum, c) => sum + c.length, 0)
    const out = new Int16Array(total)
    let offset = 0
    for (const chunk of chunks) {
        out.set(chunk, offset)
        offset += chunk.length
    }
    return out
}
