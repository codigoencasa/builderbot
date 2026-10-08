/**
 * LAYER: Interface
 * Contains: GoHighLevelInterface, GHLMessage, GHLSendMessageBody, SaveFileOptions
 * Rules: Handles HTTP/CLI. Calls use cases only. No direct domain/infrastructure access.
 * BigO: O(1) score:5
 * keywords: [GoHighLevelInterface, GHLMessage, GHLSendMessageBody, SaveFileOptions]
 * GOAL: Own the "gohighlevel" concern of the provider-gohighlevel package.
 */
import type { SendOptions, BotContext, Button } from '@builderbot/bot/dist/types'

import type { GHLMessage, GHLSendMessageBody, SaveFileOptions } from '~/types'

export interface GoHighLevelInterface {
    sendText: (to: string, message: string) => Promise<any>
    sendMedia: (to: string, text: string, mediaInput: string) => Promise<any>
    sendButtons: (to: string, buttons: Button[], text: string) => Promise<any>
    sendMessage: (to: string, message: string, options?: SendOptions) => Promise<any>
    sendMessageToApi: (body: GHLSendMessageBody) => Promise<any>
    saveFile: (ctx: Partial<GHLMessage & BotContext>, options?: SaveFileOptions) => Promise<string>
    resolveContactId: (phone: string) => Promise<string | null>
}
