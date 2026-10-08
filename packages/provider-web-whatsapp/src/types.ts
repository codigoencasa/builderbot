/**
 * LAYER: Domain
 * Contains: Types, BotCtxMiddleware
 * Rules: No external dependencies. Pure business logic.
 * BigO: O(1) score:5
 * keywords: [Types, BotCtxMiddleware]
 * GOAL: Own the "types" concern of the provider-web-whatsapp package.
 */
import type { ProviderClass } from '@builderbot/bot'

export type BotCtxMiddleware = Partial<ProviderClass & { provider: any }>
