import type { GlobalVendorArgs } from '@builderbot/bot/dist/types'
import type { ISttAdapter, ITtsAdapter } from '@builderbot/provider-voice'

export type { ISttAdapter, ITtsAdapter }

// ── Enums ────────────────────────────────────────────────────────────────────

/**
 * Events emitted by the WhatsApp Calling webhook.
 *
 * @example
 * if (event.event === CallEvent.Connect) { ... }
 */
export enum CallEvent {
    /** Inbound call is arriving — SDP offer is present in the payload. */
    Connect = 'connect',
    /** Call has ended by the remote party or timed out. */
    Terminate = 'terminate',
}

/**
 * Actions that can be sent to the Meta Graph API `/calls` endpoint.
 *
 * @example
 * await client.preAccept(callId, sdpAnswer) // action: CallAction.PreAccept
 */
export enum CallAction {
    /** Pre-accept the call and exchange SDP — must precede Accept. */
    PreAccept = 'pre_accept',
    /** Fully accept the call after pre_accept has been acknowledged. */
    Accept = 'accept',
    /** Reject the incoming call. */
    Reject = 'reject',
    /** End an active call. */
    End = 'end',
    /** Initiate an outbound call (reserved for future use in v1). */
    Call = 'call',
}

/**
 * Direction of the WhatsApp voice call.
 */
export enum CallDirection {
    /** Call was initiated by the end user (inbound from the bot's perspective). */
    UserInitiated = 'USER_INITIATED',
    /** Call was initiated by the business (outbound from the bot's perspective). */
    BusinessInitiated = 'BUSINESS_INITIATED',
}

/**
 * Internal state machine states for a single call session.
 *
 * Transitions:
 * Idle → Connecting → PreAccepted → Accepted → Active → Terminated
 */
export enum CallState {
    /** No active call for this call_id. */
    Idle = 'idle',
    /** SDP offer received; PC being built and answer prepared. */
    Connecting = 'connecting',
    /** pre_accept has been acknowledged by Meta. */
    PreAccepted = 'pre_accepted',
    /** accept has been acknowledged by Meta. */
    Accepted = 'accepted',
    /** ICE negotiation complete; RTP audio is flowing. */
    Active = 'active',
    /** Call has ended and resources have been released. */
    Terminated = 'terminated',
}

// ── Webhook payload interfaces ────────────────────────────────────────────────

/**
 * SDP session descriptor exchanged during WhatsApp call signalling.
 */
export interface WhatsAppCallSession {
    /** SDP string (offer or answer). */
    sdp: string
    /** SDP type — always 'offer' for inbound webhooks. */
    sdp_type: 'offer' | 'answer'
}

/**
 * A single call event entry within a WhatsApp webhook change.
 */
export interface WhatsAppCallEntryEvent {
    /** Unique call identifier used for all subsequent API calls. */
    id: string
    /** Caller's WhatsApp phone number (E.164). */
    from: string
    /** Callee's WhatsApp phone number (E.164). */
    to: string
    /** Type of event — connect or terminate. */
    event: CallEvent
    /** ISO-8601 timestamp of the event. */
    timestamp: string
    /** Who initiated the call. */
    direction: CallDirection
    /** SDP session descriptor — present only on connect events. */
    session?: WhatsAppCallSession
}

/**
 * The value object inside a WhatsApp calls webhook change entry.
 */
export interface WhatsAppCallValue {
    /** Always 'whatsapp'. */
    messaging_product: 'whatsapp'
    /** Metadata about the receiving phone number. */
    metadata: {
        /** Human-readable display phone number. */
        display_phone_number: string
        /** WhatsApp Business API phone number ID. */
        phone_number_id: string
    }
    /** Array of call events in this batch. */
    calls: WhatsAppCallEntryEvent[]
}

/**
 * A single entry in a WhatsApp webhook payload.
 */
export interface WhatsAppCallEntry {
    /** WhatsApp Business Account ID. */
    id: string
    /** List of field changes in this entry. */
    changes: {
        value: WhatsAppCallValue
        /** Field name — 'calls' for voice call events. */
        field: 'calls'
    }[]
}

/**
 * Top-level structure of a WhatsApp Business webhook payload.
 */
export interface WhatsAppCallWebhookPayload {
    /** Always 'whatsapp_business_account'. */
    object: 'whatsapp_business_account'
    /** List of business account entries. */
    entry: WhatsAppCallEntry[]
}

/**
 * Body sent to the Meta Graph API `/calls` endpoint for call control.
 */
export interface CallActionBody {
    /** Always 'whatsapp'. */
    messaging_product: 'whatsapp'
    /** The action to perform on the call. */
    action: CallAction
    /** The call identifier returned in the webhook. */
    call_id: string
    /** SDP answer — required for both `pre_accept` and `accept` actions. */
    session?: {
        /** SDP answer string. */
        sdp: string
        /** Always 'answer' when sending to Meta. */
        sdp_type: 'answer'
    }
}

/**
 * Payload emitted on the 'message' event for each transcribed caller utterance.
 * Conforms to BuilderBot's BotContext shape.
 */
export interface WhatsAppVoicePayload {
    /** Transcribed text from the caller. */
    body: string
    /** Caller's WhatsApp phone number (E.164). */
    from: string
    /** Display name — same as `from` for voice calls. */
    name: string
    /** Raw PCM (16-bit LE mono) of the captured utterance. */
    audio?: Buffer
    /** Sample rate of the captured audio in Hz. */
    sampleRate?: number
}

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
