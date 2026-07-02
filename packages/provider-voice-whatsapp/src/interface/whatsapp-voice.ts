import type { BotContext, SendOptions } from '@builderbot/bot/dist/types'

import type { WhatsAppVoicePayload } from '../types'

/**
 * Public interface contract for `WhatsAppVoiceProvider`.
 *
 * Defines the minimum surface that the provider must expose to be compatible
 * with BuilderBot's provider system for WhatsApp voice calls.
 */
export interface WhatsAppVoiceInterface {
    /**
     * Synthesize `message` to speech and transmit it to the caller identified
     * by `userId` over their active WebRTC peer connection.
     *
     * @param userId  The caller's phone number (matches `ctx.from` in the flow).
     * @param message The text to synthesize and send.
     * @param options Optional send options (media and buttons are not supported for voice).
     * @returns Resolves when the audio has been transmitted.
     */
    sendMessage(userId: string, message: string, options?: SendOptions): Promise<unknown>

    /**
     * Save a voice call audio buffer to the local filesystem as a WAV file.
     *
     * @param ctx     The message context containing the audio buffer.
     * @param options Optional path configuration.
     * @returns The absolute path to the saved WAV file.
     */
    saveFile(ctx: Partial<WhatsAppVoicePayload & BotContext>, options?: { path: string }): Promise<string>
}
