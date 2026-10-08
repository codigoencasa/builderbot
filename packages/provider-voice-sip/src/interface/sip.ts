/**
 * LAYER: Interface
 * Contains: SIPInterface, SIPPayload
 * Rules: Handles HTTP/CLI. Calls use cases only. No direct domain/infrastructure access.
 * BigO: O(1) score:5
 * keywords: [SIPInterface, SIPPayload]
 * GOAL: Own the "sip" concern of the provider-voice-sip package.
 */
import type { BotContext, SendOptions } from '@builderbot/bot/dist/types'

import type { SIPPayload } from '../types'

export interface SIPInterface {
    sendMessage: (userId: string, message: string, options?: SendOptions) => Promise<unknown>
    saveFile: (ctx: Partial<SIPPayload & BotContext>, options?: { path: string }) => Promise<string>
}
