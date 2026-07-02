/**
 * @builderbot/provider-voice-whatsapp
 *
 * WhatsApp Business voice call provider for BuilderBot.
 * Accepts inbound calls via the Meta Graph API, negotiates WebRTC/SDP,
 * and runs an STT/TTS audio pipeline using pluggable adapters.
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/calling/
 *
 * @example
 * import { createProvider } from '@builderbot/bot'
 * import { WhatsAppVoiceProvider, CallEvent } from '@builderbot/provider-voice-whatsapp'
 *
 * const provider = createProvider(WhatsAppVoiceProvider, {
 *   jwtToken: process.env.META_JWT_TOKEN,
 *   numberId: process.env.META_NUMBER_ID,
 *   verifyToken: process.env.META_VERIFY_TOKEN,
 *   version: 'v20.0',
 *   openaiApiKey: process.env.OPENAI_API_KEY,
 * })
 */

import { OpenAISTTAdapter } from '@builderbot/provider-voice'
import { DeepgramSTTAdapter, DeepgramSTTModel } from '@builderbot/provider-voice'
import { OpenAITTSAdapter } from '@builderbot/provider-voice'
import { ElevenLabsTTSAdapter, ElevenLabsModel } from '@builderbot/provider-voice'
import { DeepgramTTSAdapter, DeepgramTTSModel } from '@builderbot/provider-voice'
import { CartesiaTTSAdapter, CartesiaModel } from '@builderbot/provider-voice'

// ── Main provider ─────────────────────────────────────────────────────────────

export { WhatsAppVoiceProvider } from './whatsapp-voice/provider'

// ── Enums ─────────────────────────────────────────────────────────────────────

export { CallEvent, CallAction, CallDirection, CallState } from './types'

// ── Types / Interfaces ────────────────────────────────────────────────────────

export type {
    IWhatsAppVoiceProviderArgs,
    WhatsAppVoicePayload,
    WhatsAppCallWebhookPayload,
    WhatsAppCallEntry,
    WhatsAppCallValue,
    WhatsAppCallEntryEvent,
    WhatsAppCallSession,
    CallActionBody,
} from './types'

// ── Adapter interfaces (re-exported from provider-voice for consumer convenience) ──

export type { ISttAdapter, ITtsAdapter } from './types'

// ── STT adapters ──────────────────────────────────────────────────────────────

export { OpenAISTTAdapter, DeepgramSTTAdapter, DeepgramSTTModel }

// ── TTS adapters ──────────────────────────────────────────────────────────────

export {
    OpenAITTSAdapter,
    ElevenLabsTTSAdapter,
    ElevenLabsModel,
    DeepgramTTSAdapter,
    DeepgramTTSModel,
    CartesiaTTSAdapter,
    CartesiaModel,
}
