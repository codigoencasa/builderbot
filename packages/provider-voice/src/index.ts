export { VoiceProvider } from './voice/provider'
export { SttModel, TtsModel, TtsVoice } from './types'
export type { IVoiceProviderArgs, VoicePayload } from './types'

// STT adapters
export { OpenAISTTAdapter } from './adapters/stt/openai'
export { DeepgramSTTAdapter, DeepgramSTTModel } from './adapters/stt/deepgram'

// TTS adapters
export { OpenAITTSAdapter } from './adapters/tts/openai'
export { ElevenLabsTTSAdapter, ElevenLabsModel } from './adapters/tts/elevenlabs'
export { DeepgramTTSAdapter, DeepgramTTSModel } from './adapters/tts/deepgram'
export { CartesiaTTSAdapter, CartesiaModel } from './adapters/tts/cartesia'

// Adapter interfaces
export type { ISttAdapter, ITtsAdapter } from './adapters/index'

// Audio utilities (shared with provider-voice-whatsapp and other consumers)
export { SilenceSegmenter, chunkPcm, bufferToInt16, int16ToBuffer, pcmToWav, frameRms, resamplePcm } from './audio'
export type { SilenceSegmenterOptions } from './audio'

// ── Meta (WhatsApp Business) call core — shared by provider-voice-whatsapp and provider-meta ──
export { MetaCallCoreVendor } from './calls/core'
export type { MetaCallCoreVendorArgs } from './calls/core'
export { MetaCallClient } from './calls/meta-call-client'
export type { MetaCallClientArgs } from './calls/meta-call-client'
export { transformAnswer, assertOpus } from './calls/sdp'
export { createPeerConnection, createAudioSink, createAudioSource, waitForIceGathering } from './calls/webrtc'
export type { AudioSinkData, RTCAudioSinkInstance, RTCAudioSourceInstance } from './calls/webrtc'
export { CallEvent, CallAction, CallDirection, CallState } from './calls/types'
export type {
    IMetaCallCoreConfig,
    WhatsAppCallSession,
    WhatsAppCallEntryEvent,
    WhatsAppCallValue,
    WhatsAppCallEntry,
    WhatsAppCallWebhookPayload,
    CallActionBody,
    WhatsAppVoicePayload,
} from './calls/types'
