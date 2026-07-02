import type { GlobalVendorArgs } from '@builderbot/bot/dist/types'

/**
 * Configuration for @builderbot/provider-voice-sip.
 * The bot listens for inbound PSTN/SIP calls via a LiveKit SIP inbound trunk.
 * Callers are transcribed with OpenAI Whisper and answered with OpenAI TTS.
 */
export interface ISIPProviderArgs extends GlobalVendorArgs {
    // LiveKit server
    apiKey: string
    apiSecret: string
    /** WebSocket URL, e.g. wss://my-project.livekit.cloud — the host is derived for SipClient. */
    wsUrl: string

    // SIP inbound trunk
    /** Phone numbers that will receive calls, e.g. ['+14155551234']. */
    inboundNumbers: string[]
    /** CIDR/IP whitelist for the SIP carrier, e.g. ['192.168.0.0/24']. Recommended in production. */
    allowedAddresses?: string[]
    /** Optional caller-ID whitelist. Only listed numbers can reach the bot. */
    allowedCallNumbers?: string[]
    /** SIP auth username for the trunk. */
    sipAuthUsername?: string
    /** SIP auth password for the trunk. */
    sipAuthPassword?: string
    /** Map SIP header names to LiveKit participant attribute names, e.g. { 'X-CustomerId': 'customerId' }. */
    headersToAttributes?: Record<string, string>

    // Dispatch rule
    /**
     * How inbound calls are routed to rooms.
     * - 'direct': all callers join the same `roomName`.
     * - 'individual': each caller gets their own room prefixed by `dispatchRuleRoomPrefix`.
     * Default: 'direct'.
     */
    dispatchRuleType?: 'direct' | 'individual'
    /** Room name for 'direct' dispatch. Default: 'sip-support'. */
    roomName?: string
    /** Room name prefix for 'individual' dispatch. Default: 'call-'. */
    dispatchRuleRoomPrefix?: string
    /** Optional PIN required before joining (e.g. IVR-style gating). */
    dispatchRulePin?: string

    // Bot identity in the room (for TTS publishing)
    identity?: string

    // OpenAI pipeline (same as provider-voice)
    openaiApiKey: string
    sttModel?: string
    ttsModel?: string
    ttsVoice?: string
    language?: string
    silenceMs?: number
    silenceThreshold?: number

    // Audio quality
    krispEnabled?: boolean
}

/** Payload emitted on 'message' — extends BotContext with SIP metadata. */
export interface SIPPayload {
    body: string
    from: string
    name: string
    audio?: Buffer
    sampleRate?: number
}
