import type { BotContext, SendOptions } from '@builderbot/bot/dist/types'

import type { SIPPayload } from '../types'

export interface SIPInterface {
    sendMessage: (userId: string, message: string, options?: SendOptions) => Promise<unknown>
    saveFile: (ctx: Partial<SIPPayload & BotContext>, options?: { path: string }) => Promise<string>
}
