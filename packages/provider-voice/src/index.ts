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
