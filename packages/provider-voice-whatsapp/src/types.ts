import type { GlobalVendorArgs } from '@builderbot/bot/dist/types'
import type { ISttAdapter, ITtsAdapter } from '@builderbot/provider-voice'

export type { ISttAdapter, ITtsAdapter }

// ── Call enums / payload types — re-exported from the shared @builderbot/provider-voice core ──

export { CallEvent, CallAction, CallDirection, CallState } from '@builderbot/provider-voice'

export type {
    WhatsAppCallSession,
    WhatsAppCallEntryEvent,
    WhatsAppCallValue,
    WhatsAppCallEntry,
    WhatsAppCallWebhookPayload,
    CallActionBody,
    WhatsAppVoicePayload,
} from '@builderbot/provider-voice'

// ── Provider configuration union ─────────────────────────────────────────────

/**
 * Base configuration shared by all WhatsApp Voice provider configurations.
 * Extends the common GlobalVendorArgs (name, port, writeMyself).
 */
interface IWhatsAppVoiceProviderBase extends GlobalVendorArgs {
    /**
     * Meta Graph API JWT (permanent or temporary system user token).
     * @see https://developers.facebook.com/docs/whatsapp/cloud-api/calling/
     */
    jwtToken: string
    /**
     * WhatsApp Business phone number ID (numeric string).
     * @see https://developers.facebook.com/docs/whatsapp/cloud-api/calling/
     */
    numberId: string
    /**
     * Webhook verification token — must match what is set in the Meta App Dashboard.
     * @see https://developers.facebook.com/docs/whatsapp/cloud-api/calling/
     */
    verifyToken: string
    /**
     * Meta Graph API version, e.g. 'v20.0'.
     * @see https://developers.facebook.com/docs/whatsapp/cloud-api/calling/
     */
    version: string
    /** Language hint (ISO-639-1) for STT transcription, e.g. 'es'. */
    language?: string
    /** Milliseconds of trailing silence that close an utterance. Default 800. */
    silenceMs?: number
    /** RMS amplitude (0..1) below which a frame is considered silence. Default 0.015. */
    silenceThreshold?: number
    /** ICE server configuration for the WebRTC peer connection. */
    iceServers?: RTCIceServer[]
    /**
     * Maximum time in milliseconds to wait for ICE gathering to complete before
     * sending the SDP to Meta via `pre_accept`. WhatsApp Calling uses non-trickle
     * ICE, so all candidates must be embedded in the SDP. Default: 2000.
     */
    iceGatheringTimeoutMs?: number
    /** Custom STT adapter. When provided, overrides the built-in OpenAI Whisper transcription. */
    sttAdapter?: ISttAdapter
    /** Custom TTS adapter. When provided, overrides the built-in OpenAI TTS synthesis. */
    ttsAdapter?: ITtsAdapter
}

/**
 * Configuration when using the default OpenAI adapters — openaiApiKey is required.
 */
interface IWhatsAppVoiceProviderWithOpenAI extends IWhatsAppVoiceProviderBase {
    /** OpenAI API key used for the default STT (Whisper) and TTS adapters. */
    openaiApiKey: string
    sttAdapter?: undefined
    ttsAdapter?: undefined
}

/**
 * Configuration when providing both custom adapters — openaiApiKey is optional.
 */
interface IWhatsAppVoiceProviderWithAdapters extends IWhatsAppVoiceProviderBase {
    /** OpenAI API key. Optional when custom adapters cover both STT and TTS. */
    openaiApiKey?: string
    /** Custom STT adapter. */
    sttAdapter: ISttAdapter
    /** Custom TTS adapter. */
    ttsAdapter: ITtsAdapter
}

/**
 * Configuration when providing only a custom STT adapter —
 * openaiApiKey still required for the default TTS adapter.
 */
interface IWhatsAppVoiceProviderWithSttAdapter extends IWhatsAppVoiceProviderBase {
    /** OpenAI API key used for the default TTS adapter. */
    openaiApiKey: string
    /** Custom STT adapter. */
    sttAdapter: ISttAdapter
    ttsAdapter?: undefined
}

/**
 * Configuration when providing only a custom TTS adapter —
 * openaiApiKey still required for the default STT adapter.
 */
interface IWhatsAppVoiceProviderWithTtsAdapter extends IWhatsAppVoiceProviderBase {
    /** OpenAI API key used for the default STT adapter. */
    openaiApiKey: string
    sttAdapter?: undefined
    /** Custom TTS adapter. */
    ttsAdapter: ITtsAdapter
}

/**
 * Configuration arguments for the WhatsApp voice provider.
 *
 * When custom adapters are provided for both STT and TTS, `openaiApiKey` becomes optional.
 * When only one adapter is provided (or neither), `openaiApiKey` remains required.
 *
 * @example
 * // Default OpenAI adapters
 * createProvider(WhatsAppVoiceProvider, {
 *   jwtToken: '...', numberId: '...', verifyToken: '...', version: 'v20.0',
 *   openaiApiKey: '...'
 * })
 *
 * @example
 * // Custom adapters
 * createProvider(WhatsAppVoiceProvider, {
 *   jwtToken: '...', numberId: '...', verifyToken: '...', version: 'v20.0',
 *   sttAdapter: new MySTT(), ttsAdapter: new MyTTS()
 * })
 */
export type IWhatsAppVoiceProviderArgs =
    | IWhatsAppVoiceProviderWithOpenAI
    | IWhatsAppVoiceProviderWithAdapters
    | IWhatsAppVoiceProviderWithSttAdapter
    | IWhatsAppVoiceProviderWithTtsAdapter
