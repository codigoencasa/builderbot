/**
 * LAYER: Interface
 * Contains: EvolutionInterface, SaveFileOptions
 * Rules: Handles HTTP/CLI. Calls use cases only. No direct domain/infrastructure access.
 * BigO: O(1) score:5
 * keywords: [EvolutionInterface, SaveFileOptions]
 * GOAL: Own the "evolution" concern of the provider-evolution-api package.
 */
import type { BotContext } from '@builderbot/bot/dist/types'
import type polka from 'polka'

import type { SaveFileOptions } from '../types'

export interface EvolutionInterface {
    // Interface elements
    indexHome?: polka.Middleware

    // Queue related methods that are used in the implementation
    sendMessageEvoApi: (body: any, ruta: string) => Promise<any>
    sendMessageMeta: (body: any) => Promise<any>
    sendMessageToApi: (body: any, ruta?: string) => Promise<any>

    // Message sending methods
    sendMessage: <K = any>(to: string, message: string, args?: any) => Promise<K>
    sendText: (to: string, message: string, context?: string | null) => Promise<any>
    sendImage: (to: string, mediaInput: string, caption?: string, context?: string | null) => Promise<any>
    sendVideo: (to: string, mediaUrl: string, mediaName?: string, caption?: string) => Promise<any>
    sendAudio: (to: string, mediaUrl: string, mediaName?: string, caption?: string) => Promise<any>
    sendMedia: (to: string, file: string, type: string) => Promise<any>
    sendFile: (to: string, file: string, caption?: string) => Promise<any>
    incomingMsg: (req: any, res: any) => void | Promise<void>
}
