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
    url?: string
    fileData?: File | null
    payload?: string
    title_button_reply?: string
    title_list_reply?: string
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
}

export type TextGenericParams = {
    messaging_product: 'whatsapp'
    recipient_type: string
    to: string
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

/** A single `errors[]` entry on a Meta message status update. */
export interface MessageStatusError {
    error_data?: { details?: string }
}

/** A single entry in `value.statuses[]` on a message-status webhook change. */
export interface MessageStatus {
    recipient_id?: string
    recipient_user_id?: string
    errors?: MessageStatusError[]
    status?: string
}

export interface Metadata {
    display_phone_number: string
    phone_number_id: string
}

export interface ContactMeta {
    profile: Profile
    wa_id?: string
    user_id?: string
    name: string
    phones: string[]
}

export interface Profile {
    name: string
}

export interface MessageFromMeta {
    from: string
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
