/**
 * LAYER: Domain
 * Contains: BotCtxMiddleware, SaveFileOptions
 * Rules: No external dependencies. Pure business logic.
 * BigO: O(1) score:5
 * keywords: [BotCtxMiddleware, SaveFileOptions]
 * GOAL: Own the "types" concern of the provider-venom package.
 */
import type { ProviderClass } from '@builderbot/bot'

export type BotCtxMiddleware = Partial<ProviderClass & { provider: any }>
export interface SaveFileOptions {
    path?: string
}
