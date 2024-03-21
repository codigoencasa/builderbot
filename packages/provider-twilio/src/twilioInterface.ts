import { SendOptions, BotContext } from '@builderbot/bot/dist/types'

import { TwilioRequestBody } from './types'

export interface TwilioProviderMethods {
    sendMedia: (number: string, message: string, mediaInput: string) => Promise<any>
    sendMessage: (number: string, message: string, options?: SendOptions) => Promise<any>
    saveFile: (ctx: Partial<TwilioRequestBody & BotContext>, options?: { path: string }) => Promise<string>
}
