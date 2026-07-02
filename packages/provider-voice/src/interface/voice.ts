import type { BotContext, SendOptions } from '@builderbot/bot/dist/types'

import type { VoicePayload } from '../types'

/**
 * Public contract implemented by VoiceProvider.
 */
export interface VoiceInterface {
    /** Synthesize `message` to speech and publish it into the LiveKit room. */
    sendMessage: (userId: string, message: string, options?: SendOptions) => Promise<unknown>
    /** Persist an incoming audio utterance to disk as a .wav file. */
    saveFile: (ctx: Partial<VoicePayload & BotContext>, options?: { path: string }) => Promise<string>
}
