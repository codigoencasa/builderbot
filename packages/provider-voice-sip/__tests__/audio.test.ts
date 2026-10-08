import { describe, expect, test } from '@jest/globals'

import { bufferToInt16, chunkPcm, frameRms, int16ToBuffer, pcmToWav, resamplePcm, SilenceSegmenter } from '../src/audio'

const silence = (n: number): Int16Array => new Int16Array(n) // all zeros
const tone = (n: number, amp = 8000): Int16Array => {
    const out = new Int16Array(n)
    for (let i = 0; i < n; i++) out[i] = i % 2 === 0 ? amp : -amp
    return out
}

describe('#pcmToWav', () => {
    test('prepends a valid 44-byte RIFF/WAVE header', () => {
        const pcm = int16ToBuffer(tone(100))
        const wav = pcmToWav(pcm, 16000)

        expect(wav.length).toBe(44 + pcm.length)
        expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
        expect(wav.toString('ascii', 8, 12)).toBe('WAVE')
        expect(wav.readUInt32LE(24)).toBe(16000) // sample rate
        expect(wav.readUInt16LE(22)).toBe(1) // mono
        expect(wav.readUInt16LE(34)).toBe(16) // bits per sample
        expect(wav.readUInt32LE(40)).toBe(pcm.length) // data size
    })
})

describe('#frameRms', () => {
    test('returns 0 for silence and a positive value for a tone', () => {
        expect(frameRms(silence(128))).toBe(0)
        expect(frameRms(tone(128))).toBeGreaterThan(0)
    })

    test('returns 0 for an empty frame', () => {
        expect(frameRms(new Int16Array(0))).toBe(0)
    })
})

describe('#int16ToBuffer / #bufferToInt16', () => {
    test('round-trips samples', () => {
        const samples = tone(64)
        const restored = bufferToInt16(int16ToBuffer(samples))
        expect(Array.from(restored)).toEqual(Array.from(samples))
    })
})

describe('#resamplePcm', () => {
    test('returns the same array when rates match', () => {
        const samples = tone(50)
        expect(resamplePcm(samples, 24000, 24000)).toBe(samples)
    })

    test('downsamples to roughly half the length when halving the rate', () => {
        const samples = tone(100)
        const out = resamplePcm(samples, 24000, 12000)
        expect(out.length).toBe(50)
    })
})

describe('#chunkPcm', () => {
    test('splits into fixed-size frames and zero-pads the last one', () => {
        const samples = tone(250)
        const frames = chunkPcm(samples, 100)
        expect(frames.length).toBe(3)
        expect(frames[0].length).toBe(100)
        expect(frames[2].length).toBe(100) // padded
        expect(frames[2][50]).toBe(0) // padding region
    })

    test('throws on a non-positive frame size', () => {
        expect(() => chunkPcm(tone(10), 0)).toThrow()
    })
})

describe('#SilenceSegmenter', () => {
    const sampleRate = 16000

    test('drops leading silence and emits an utterance after trailing silence', () => {
        const segmenter = new SilenceSegmenter({
            sampleRate,
            silenceMs: 100, // 1600 samples of silence to close
            silenceThreshold: 0.01,
            minUtteranceMs: 10,
        })
        const frame = 800 // 50ms frames

        // leading silence -> ignored
        expect(segmenter.push(silence(frame))).toBeNull()
        // speech
        expect(segmenter.push(tone(frame))).toBeNull()
        expect(segmenter.push(tone(frame))).toBeNull()
        // one 50ms silent frame: not enough (needs 100ms)
        expect(segmenter.push(silence(frame))).toBeNull()
        // second silent frame -> total 100ms silence -> close
        const utterance = segmenter.push(silence(frame))
        expect(utterance).not.toBeNull()
        // contains the two speech frames + trailing silence buffered
        expect((utterance as Buffer).length).toBeGreaterThan(0)
    })

    test('discards utterances shorter than the minimum', () => {
        const segmenter = new SilenceSegmenter({
            sampleRate,
            silenceMs: 50,
            silenceThreshold: 0.01,
            minUtteranceMs: 1000, // require 1s of speech
        })
        segmenter.push(tone(400)) // 25ms speech
        const result = segmenter.push(silence(1600)) // 100ms silence closes
        expect(result).toBeNull()
    })

    test('flush returns null when nothing was captured', () => {
        const segmenter = new SilenceSegmenter({
            sampleRate,
            silenceMs: 50,
            silenceThreshold: 0.01,
        })
        expect(segmenter.flush()).toBeNull()
    })

    test('resets state so a second utterance on the same segmenter works', () => {
        const segmenter = new SilenceSegmenter({
            sampleRate,
            silenceMs: 100,
            silenceThreshold: 0.01,
            minUtteranceMs: 10,
        })
        const frame = 800 // 50ms

        // First utterance.
        expect(segmenter.push(tone(frame))).toBeNull()
        expect(segmenter.push(silence(frame))).toBeNull()
        expect(segmenter.push(silence(frame))).not.toBeNull()

        // Second utterance must be detected just like the first (clean reset).
        expect(segmenter.push(silence(frame))).toBeNull() // leading silence dropped
        expect(segmenter.push(tone(frame))).toBeNull()
        expect(segmenter.push(silence(frame))).toBeNull()
        const second = segmenter.push(silence(frame))
        expect(second).not.toBeNull()
    })

    test('emitted utterance bytes equal the buffered speech frames', () => {
        const segmenter = new SilenceSegmenter({
            sampleRate,
            silenceMs: 50, // 800 samples
            silenceThreshold: 0.01,
            minUtteranceMs: 10,
        })
        const speech = tone(800)
        const tail = silence(800) // 50ms closes

        segmenter.push(speech)
        const utterance = segmenter.push(tail) as Buffer
        expect(utterance).not.toBeNull()

        // Content = speech frame + the trailing silence frame that closed it.
        const expected = Buffer.concat([int16ToBuffer(speech), int16ToBuffer(tail)])
        expect(utterance.equals(expected)).toBe(true)
    })

    test('force-cuts a runaway utterance at maxUtteranceMs', () => {
        const segmenter = new SilenceSegmenter({
            sampleRate,
            silenceMs: 5000, // never reached in this test
            silenceThreshold: 0.01,
            minUtteranceMs: 10,
            maxUtteranceMs: 100, // 1600 samples
        })
        // Continuous speech, no silence: must still flush at the cap.
        expect(segmenter.push(tone(800))).toBeNull() // 800 < 1600
        const cut = segmenter.push(tone(800)) // 1600 >= 1600 -> force cut
        expect(cut).not.toBeNull()
        expect((cut as Buffer).length).toBe(1600 * 2)
    })

    test('does not pad the last frame when pad=false', () => {
        const samples = tone(250)
        const frames = chunkPcm(samples, 100, false)
        expect(frames.length).toBe(3)
        expect(frames[2].length).toBe(50) // real length, not padded
    })
})
