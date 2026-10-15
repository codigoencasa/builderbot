/**
 * LAYER: Domain
 * Contains: Response, BotCtxMiddleware, SaveFileOptions
 * Rules: No external dependencies. Pure business logic.
 * BigO: O(1) score:5
 * keywords: [Response, BotCtxMiddleware, SaveFileOptions]
 * GOAL: Own the "types" concern of the provider-wppconnect package.
 */
import type { ProviderClass } from '@builderbot/bot'
export interface Response {
    type: string
    data: Buffer
}

export type BotCtxMiddleware = Partial<ProviderClass & { provider: any }>

export interface SaveFileOptions {
    path?: string
}
