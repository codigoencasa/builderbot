/**
 * LAYER: Domain
 * Contains: CallEvent, CallAction, CallDirection, CallState
 * Rules: No external dependencies. Pure business logic.
 * BigO: O(1) score:5
 * keywords: [CallEvent, CallAction, CallDirection, CallState]
 * GOAL: Own the "types" concern of the provider-voice package.
 */
import type { ISttAdapter, ITtsAdapter } from '../adapters/index'

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
    /**
     * Terminate an active call.
     *
     * Wire value per the Meta Calling API reference: `POST /{phone-number-id}/calls`
     * accepts `connect | pre_accept | accept | reject | terminate`.
     * @see https://developers.facebook.com/docs/whatsapp/cloud-api/calling/reference/
     */
    Terminate = 'terminate',
    /**
     * @deprecated Use {@link Terminate}. Kept as an alias for backward
     * compatibility — its wire value was corrected from the invalid `'end'`
     * (rejected by Meta with a 4xx) to Meta's documented `'terminate'`.
     */
    // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values -- intentional deprecated alias
    End = 'terminate',
    /**
     * Initiate a business-initiated (outbound) call. Wire value per the Meta
     * Calling API reference.
     * @see https://developers.facebook.com/docs/whatsapp/cloud-api/calling/reference/
     */
    Connect = 'connect',
    /**
     * @deprecated Use {@link Connect}. Kept as an alias — its wire value was
     * corrected from the invalid `'call'` to Meta's documented `'connect'`.
     */
    // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values -- intentional deprecated alias
    Call = 'connect',
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
    /**
     * Call status updates — Meta only sends these for business-initiated calls
     * (`RINGING` | `ACCEPTED` | `REJECTED`). Inbound calls only produce
     * `connect` / `terminate` entries in {@link calls}.
     */
    statuses?: WhatsAppCallStatus[]
}

/**
 * A single call status entry (business-initiated calls only).
 */
export interface WhatsAppCallStatus {
    /** The WhatsApp call ID (`wacid...`). */
    id: string
    /** Always 'call'. */
    type: string
    /** Current status — `RINGING` | `ACCEPTED` | `REJECTED`. */
    status: string
    /** Unix timestamp (seconds, as a string). */
    timestamp: string
    /** The WhatsApp user's phone number (callee). */
    recipient_id?: string
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

/**
 * Payload emitted on the `call_active` event.
 *
 * Fired once the WebRTC media path is open (the call is `Active`), which is the
 * first moment audio sent to the caller is actually heard. Useful to greet the
 * caller from a flow (`bot.dispatch('CALL_GREETING', { from })`) or to log the
 * start of a call.
 */
export interface CallActiveEvent {
    /** The WhatsApp call ID. */
    callId: string
    /** Caller's WhatsApp phone number (E.164). */
    from: string
    /** Callee's WhatsApp phone number (E.164). */
    to: string
    /** Who initiated the call. */
    direction: CallDirection
}

/**
 * Payload emitted on the `call_ended` event when a known call is released
 * (caller hung up, business ended it, or the peer connection failed/closed).
 */
export interface CallEndedEvent {
    /** The WhatsApp call ID. */
    callId: string
    /** Caller's WhatsApp phone number (E.164). */
    from: string
}

/**
 * Payload emitted on the `playback_interrupted` event when barge-in cuts the
 * bot's audio because the caller started talking.
 */
export interface PlaybackInterruptedEvent {
    /** The WhatsApp call ID. */
    callId: string
    /** Caller's WhatsApp phone number (E.164). */
    from: string
}

/**
 * Payload emitted on the `call_status` event for business-initiated calls
 * (`RINGING` | `ACCEPTED` | `REJECTED`).
 */
export interface CallStatusEvent {
    /** The WhatsApp call ID. */
    callId: string
    /** Current status — `RINGING` | `ACCEPTED` | `REJECTED`. */
    status: string
    /** Unix timestamp (seconds, as a string). */
    timestamp: string
    /** The WhatsApp user's phone number (callee), when present. */
    recipientId?: string
}

// ── Call core configuration ──────────────────────────────────────────────────

/**
 * Minimal configuration required by {@link MetaCallCoreVendor} to negotiate and
 * run WhatsApp Business voice calls. Decoupled from any single provider's full
 * config shape so it can be reused by `provider-voice-whatsapp`, `provider-meta`,
 * or any future consumer.
 */
export interface IMetaCallCoreConfig {
    /** Meta Graph API JWT (permanent or temporary system user token). */
    jwtToken: string
    /** WhatsApp Business phone number ID (numeric string). */
    numberId: string
    /** Meta Graph API version, e.g. 'v20.0'. */
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
    /**
     * Optional message spoken to the caller as soon as the call becomes active.
     *
     * The bot otherwise waits for the caller to speak first; set this to greet
     * them (e.g. `'Hello, how can I help you?'`).
     */
    greetingMessage?: string
    /**
     * Interrupt the bot's playback as soon as the caller starts talking
     * (barge-in). Default `true`. Set to `false` to let the bot finish its
     * sentence (the previous behaviour).
     *
     * When interrupted, the `playback_interrupted` event is emitted so flows can
     * react (e.g. not claim the full answer was heard).
     */
    bargeIn?: boolean
    /**
     * Milliseconds of continuous speech required before barge-in cuts the
     * playback. Guards against noise blips. Default 120.
     */
    bargeInMinSpeechMs?: number
}
