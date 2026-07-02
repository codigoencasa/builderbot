import type { GlobalVendorArgs } from '@builderbot/bot/dist/types'

import type { ISttAdapter, ITtsAdapter } from './adapters/index'

export { ISttAdapter, ITtsAdapter }

export enum SttModel {
    Whisper1 = 'whisper-1',
    Gpt4oMiniTranscribe = 'gpt-4o-mini-transcribe',
    Gpt4oTranscribe = 'gpt-4o-transcribe',
}

export enum TtsModel {
    Gpt4oMiniTts = 'gpt-4o-mini-tts',
    Gpt4oTts = 'gpt-4o-tts',
}

export enum TtsVoice {
    Alloy = 'alloy',
    Echo = 'echo',
    Fable = 'fable',
    Onyx = 'onyx',
    Nova = 'nova',
    Shimmer = 'shimmer',
}

/**
 * Base configuration shared by all voice provider configurations.
 * Extends the common GlobalVendorArgs (name, port, writeMyself).
 */
interface IVoiceProviderBase extends GlobalVendorArgs {
    /** LiveKit API key. */
    apiKey: string
    /** LiveKit API secret. */
    apiSecret: string
    /** LiveKit server websocket URL, e.g. wss://my-project.livekit.cloud */
    wsUrl: string
    /** Room the bot joins and listens on. */
    roomName: string
    /** Identity the bot uses inside the room. Default 'builderbot'. */
    identity?: string
    /** STT model for transcription. Default SttModel.Gpt4oMiniTranscribe. Only used when no sttAdapter is provided. */
    sttModel?: SttModel | string
    /** TTS model. Default TtsModel.Gpt4oMiniTts. Only used when no ttsAdapter is provided. */
    ttsModel?: TtsModel | string
    /** TTS voice. Default TtsVoice.Alloy. Only used when no ttsAdapter is provided. */
    ttsVoice?: TtsVoice | string
    /** Language hint (ISO-639-1) for STT, e.g. 'es'. */
    language?: string
    /** Milliseconds of silence that close an utterance. Default 800. */
    silenceMs?: number
    /** RMS amplitude (0..1) below which a frame counts as silence. Default 0.015. */
    silenceThreshold?: number
    /** Custom STT adapter. When provided, overrides the built-in OpenAI Whisper transcription. */
    sttAdapter?: ISttAdapter
    /** Custom TTS adapter. When provided, overrides the built-in OpenAI TTS synthesis. */
    ttsAdapter?: ITtsAdapter
}

/**
 * Configuration when using the default OpenAI adapters — openaiApiKey is required.
 */
interface IVoiceProviderWithOpenAI extends IVoiceProviderBase {
    /** OpenAI API key used for the default STT and TTS adapters. */
    openaiApiKey: string
    sttAdapter?: undefined
    ttsAdapter?: undefined
}

/**
 * Configuration when providing custom adapters — openaiApiKey is optional.
 */
interface IVoiceProviderWithAdapters extends IVoiceProviderBase {
    /** OpenAI API key. Optional when custom adapters cover both STT and TTS. */
    openaiApiKey?: string
    /** Custom STT adapter. */
    sttAdapter: ISttAdapter
    /** Custom TTS adapter. */
    ttsAdapter: ITtsAdapter
}

/**
 * Configuration when providing only a custom STT adapter — openaiApiKey still
 * required for the default TTS adapter.
 */
interface IVoiceProviderWithSttAdapter extends IVoiceProviderBase {
    /** OpenAI API key used for the default TTS adapter. */
    openaiApiKey: string
    /** Custom STT adapter. */
    sttAdapter: ISttAdapter
    ttsAdapter?: undefined
}

/**
 * Configuration when providing only a custom TTS adapter — openaiApiKey still
 * required for the default STT adapter.
 */
interface IVoiceProviderWithTtsAdapter extends IVoiceProviderBase {
    /** OpenAI API key used for the default STT adapter. */
    openaiApiKey: string
    sttAdapter?: undefined
    /** Custom TTS adapter. */
    ttsAdapter: ITtsAdapter
}

/**
 * Configuration arguments for the LiveKit + OpenAI voice provider.
 * When custom adapters are provided for both STT and TTS, `openaiApiKey` becomes optional.
 * When only one adapter is provided (or neither), `openaiApiKey` remains required.
 */
export type IVoiceProviderArgs =
    | IVoiceProviderWithOpenAI
    | IVoiceProviderWithAdapters
    | IVoiceProviderWithSttAdapter
    | IVoiceProviderWithTtsAdapter

/**
 * Normalized payload emitted by the core vendor for an incoming utterance,
 * compatible with BuilderBot's BotContext.
 */
export interface VoicePayload {
    body: string
    from: string
    name: string
    /** Raw PCM (16-bit LE mono) of the captured utterance. */
    audio?: Buffer
    /** Sample rate of the captured audio. */
    sampleRate?: number
}
