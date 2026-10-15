/**
 * LAYER: Interface
 * Contains: TwilioInterface, TwilioRequestBody
 * Rules: Handles HTTP/CLI. Calls use cases only. No direct domain/infrastructure access.
 * BigO: O(1) score:5
 * keywords: [TwilioInterface, TwilioRequestBody]
 * GOAL: Own the "twilio" concern of the provider-twilio package.
 */
import type { SendOptions, BotContext } from '@builderbot/bot/dist/types'

import type { TwilioRequestBody } from '../types'

export interface TwilioInterface {
    sendMedia: (number: string, message: string, mediaInput: string) => Promise<any>
    sendMessage: (number: string, message: string, options?: SendOptions) => Promise<any>
    saveFile: (ctx: Partial<TwilioRequestBody & BotContext>, options?: { path: string }) => Promise<string>
}
