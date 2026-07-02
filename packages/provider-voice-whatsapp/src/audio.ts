/**
 * Re-exports of the shared audio utilities from `@builderbot/provider-voice`.
 *
 * Consumers of `@builderbot/provider-voice-whatsapp` can import these helpers
 * from this module without depending on `@builderbot/provider-voice` directly.
 *
 * Convention: PCM is 16-bit signed little-endian, mono unless stated otherwise.
 *
 * @module audio
 */

export {
    SilenceSegmenter,
    chunkPcm,
    bufferToInt16,
    int16ToBuffer,
    frameRms,
    resamplePcm,
    pcmToWav,
} from '@builderbot/provider-voice'

export type { SilenceSegmenterOptions } from '@builderbot/provider-voice'
