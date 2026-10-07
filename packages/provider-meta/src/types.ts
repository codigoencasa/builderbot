/**
 * LAYER: Domain
 * Contains: Meta payload types and value objects (MessageStatus, MessageStatusEvent, Contact, File, orders)
 * Rules: No external dependencies. Pure structural types.
 * BigO: O(1) score:5
 * keywords: [MessageStatus, MessageStatusEvent, MetaGlobalVendorArgs]
 * GOAL: Describe the raw Meta webhook/API shapes, keeping status entries fully typed and forward-compatible.
 */
import type { GlobalVendorArgs } from '@builderbot/bot/dist/types'
import type { ISttAdapter, ITtsAdapter, WhatsAppCallEntryEvent } from '@builderbot/provider-voice'

interface Image {
    id?: string
    caption?: string
    link?: string
}

interface Video {
    id?: string
    caption?: string
    link?: string
}

export class File {
    mime_type?: string
    sha256?: string
    id?: string
    url?: string
    voice?: boolean
    animated?: boolean
    filename?: string
    caption?: string
    link?: string
}

interface TemplateMessage {
    name: string
    language: {
        code: string
    }
    components: TemplateComponent[]
}

interface TemplateComponent {
    type: 'header' | 'body' | 'button'
    parameters?: TemplateParameter[]
}

interface Section {
    title: string
    rows: Row[]
}

interface Row {
    id: string
    title: string
    description: string
}

interface TemplateParameter {
    type: string
}
export interface MediaResponse {
    url?: string
}

export interface MetaList {
    header: {
        type: string
        text: string
    }
    body: {
        text: string
    }
    footer: {
        text: string
    }
    action: {
        button: string
        sections: Section[]
    }
}

export interface MetaGlobalVendorArgs extends GlobalVendorArgs {
    jwtToken: string
    numberId: string
    verifyToken: string
    version: string
    // ── WhatsApp Business voice calls (opt-in) ──────────────────────────────
    /** Enable inbound WhatsApp Business voice call handling (WebRTC/SDP + STT/TTS). Default: false. */
    enableVoiceCalls?: boolean
    /** OpenAI API key used for the default STT (Whisper) and TTS adapters when voice calls are enabled. */
    openaiApiKey?: string
    /** Custom STT adapter. When provided, overrides the built-in OpenAI Whisper transcription. */
    sttAdapter?: ISttAdapter
    /** Custom TTS adapter. When provided, overrides the built-in OpenAI TTS synthesis. */
    ttsAdapter?: ITtsAdapter
    /** Language hint (ISO-639-1) for STT transcription, e.g. 'es'. */
    language?: string
    /**
     * Optional message spoken to the caller as soon as the call becomes active.
     * Without it the bot waits for the caller to speak first.
     */
    greetingMessage?: string
    /** Milliseconds of trailing silence that close an utterance. Default 800. */
    silenceMs?: number
    /** RMS amplitude (0..1) below which a frame is considered silence. Default 0.015. */
    silenceThreshold?: number
    /** ICE server configuration for the WebRTC peer connection used in voice calls. */
    iceServers?: RTCIceServer[]
    /**
     * Maximum time in milliseconds to wait for ICE gathering to complete before
     * sending the SDP to Meta via `pre_accept`. WhatsApp Calling uses non-trickle
     * ICE, so all candidates must be embedded in the SDP. Default: 2000.
     */
    iceGatheringTimeoutMs?: number
    // ── Webhook security (optional) ─────────────────────────────────────────
    /**
     * Meta App Secret used to validate the `X-Hub-Signature-256` header on
     * incoming webhook `POST` requests (HMAC-SHA256 over the raw body).
     * When set, requests with a missing or invalid signature are rejected
     * with `401`. Applies to both `messages` and `calls` webhook events.
     */
    appSecret?: string
    // ── Message-status webhook response (optional) ──────────────────────────
    /**
     * HTTP response for message-status webhook callbacks.
     * - `'ok'` (default): always respond `200`. Correct per Meta — non-2xx responses trigger retries.
     * - `'legacy-400'`: preserve the pre-1.4.x behaviour of responding `400` on `failed` statuses.
     */
    statusWebhookRespondOnFailure?: 'ok' | 'legacy-400'
}

export interface ProductItem {
    product_retailer_id: string
    quantity: number
    item_price?: number
    currency?: string
}

export interface Order {
    catalog_id: string
    product_items: ProductItem[]
    text?: string
}

export interface MetaOrderProduct {
    id?: string
    retailer_id: string
    name: string
    imageUrl: string
    price: number
    currency: string
    quantity: number
}

export interface MetaOrderPrice {
    currency: string
    total: number
}

export interface MetaOrderDetails {
    catalog_id: string
    title: string
    text?: string
    price: MetaOrderPrice
    products: MetaOrderProduct[]
}

export interface Contact {
    profile: Profile
    wa_id?: string
    user_id?: string
    parent_user_id?: string
    name: string
    phones: string[]
}

export interface Message {
    message_id?: string
    timestamp?: any
    type: string
    from: string
    to: string
    body: string
    pushName: string
    name: string
    userId?: string
    /** WhatsApp username from contact.profile.username when present. */
    username?: string
    url?: string
    fileData?: File | null
    payload?: string
    title_button_reply?: string
    title_list_reply?: string
    id_list_reply?: string
    latitude?: number
    longitude?: number
    contacts?: Contact[]
    nfm_reply?: string
    order?: Order
    id?: string
    caption?: string
    fromMe?: boolean
    /** Raw PCM (16-bit LE mono) of a transcribed voice call utterance. Present only for voice call messages. */
    audio?: Buffer
    /** Sample rate (Hz) of `audio`, when present. */
    sampleRate?: number
    /** Canonical id, alias of `message_id` (RFC 0003). */
    messageId?: string
    /** Canonical content classification (RFC 0003); legacy `type` is untouched. */
    contentType?: string
    /** Raw Meta webhook message, untransformed (RFC 0003). */
    raw?: unknown
}

export interface ParamsIncomingMessage {
    messageId?: string
    messageTimestamp?: any
    pushName: string
    to: string
    jwtToken: string
    numberId: string
    version: string
    message: any
    fileData?: File | null
    fromMe?: boolean
    userId?: string
    username?: string
}

export type TextGenericParams = {
    messaging_product: 'whatsapp'
    recipient_type: string
    to?: string
    recipient?: string
    type: string
    [key: string]: any
}

export interface ParsedContact {
    name: {
        formatted_name: string
        first_name: string
        [key: string]: any
    }
    phones: {
        phone: string
        type: string
        [key: string]: any
    }[]
    [key: string]: any
}

export interface TextMessageBody {
    messaging_product: string
    to?: string
    /** BSUID destination — Meta requires `recipient` instead of `to` for Business-Scoped User IDs. */
    recipient?: string
    type?: string
    recipient_type?: string
    text?: {
        preview_url: boolean
        body: string
    }
    image?: File
    video?: File
    audio?: File
    document?: File
    interactive?: any
    contacts?: any[]
    context?: {
        message_id: string
    }
    template?: TemplateMessage
    status?: string
    message_id?: string
    typing_indicator?: {
        type: string
    }
}

export interface Reaction {
    message_id: string
    emoji: string
}

export interface Localization {
    long_number: string
    lat_number: string
    name: string
    address: string
}

export interface SaveFileOptions {
    path?: string
}

export interface WhatsAppProfile {
    verified_name: string
    code_verification_status: string
    display_phone_number: string
    quality_rating: string
    platform_type: string
    throughput: {
        level: string
    }
    id: string
}

export interface IncomingMessage {
    object: string
    entry: Entry[]
}

export interface Entry {
    id: string
    changes: Change[]
}

export interface Change {
    value: Value
    field: string
}

export interface Value {
    messaging_product: string
    metadata: Metadata
    // Meta sends one of these per change: messages (+contacts), statuses, or calls — never mixed.
    contacts?: ContactMeta[]
    messages?: MessageFromMeta[]
    statuses?: MessageStatus[]
    calls?: WhatsAppCallEntryEvent[]
}

/** Known WhatsApp Cloud API delivery lifecycle states (open union — future values are accepted). */
export type WhatsAppMessageStatus = 'sent' | 'delivered' | 'read' | 'failed' | (string & {})

/** A single `errors[]` entry on a Meta message status update. */
export interface MessageStatusError {
    code?: number
    title?: string
    message?: string
    error_data?: { details?: string; [key: string]: unknown }
}

/** A single entry in `value.statuses[]` on a message-status webhook change. */
export interface MessageStatus {
    /** Meta message id (wamid) of the outbound message this status refers to — correlation key. */
    id?: string
    recipient_id?: string
    recipient_user_id?: string
    status?: WhatsAppMessageStatus
    /** Unix timestamp (seconds), string-encoded, as sent by Meta. */
    timestamp?: string
    errors?: MessageStatusError[]
    conversation?: { id?: string; origin?: { type?: string; [key: string]: unknown } }
    pricing?: { billable?: boolean; pricing_model?: string; category?: string; [key: string]: unknown }
}

/**
 * Normalized, forward-compatible payload emitted as the `message_status` event for each
 * entry in `value.statuses[]`.
 */
export interface MessageStatusEvent {
    /** wamid; `null` when Meta omitted it. */
    id: string | null
    /** `recipient_id` or, for BSUID-only users, `recipient_user_id`. */
    recipientId: string | null
    /** BSUID (`recipient_user_id`) when present. */
    recipientUserId: string | null
    status: WhatsAppMessageStatus
    timestamp: string | null
    errors: MessageStatusError[]
    /** Raw status entry — escape hatch for future Meta fields without a breaking type change. */
    raw: MessageStatus
}

/**
 * Monotonic delivery progression. Consumers can ignore out-of-order events by ranking:
 * a status is only applied when its rank is >= the last seen rank (failed is terminal-lowest).
 */
export const MESSAGE_STATUS_RANK: Record<string, number> = {
    failed: 0,
    sent: 1,
    delivered: 2,
    read: 3,
}

/** Returns the rank of a status, or `-1` for unknown statuses. */
export const statusRank = (status: string): number => MESSAGE_STATUS_RANK[status] ?? -1

export interface Metadata {
    display_phone_number: string
    phone_number_id: string
}

export interface ContactMeta {
    profile: Profile
    wa_id?: string
    user_id?: string
    parent_user_id?: string
    name: string
    phones: string[]
}

export interface Profile {
    name: string
    username?: string
}

export interface MessageFromMeta {
    from?: string
    /** BSUID when Meta omits the phone (`from`) for username-adopted users. */
    from_user_id?: string
    id: string
    timestamp: string
    text?: Text
    type: string
    fromMe?: boolean
    audio?: File | null
    image?: File | null
    video?: File | null
    document?: File | null
    sticker?: File | null
}

export interface Text {
    body: string
}
