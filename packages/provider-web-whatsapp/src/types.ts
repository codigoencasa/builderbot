import type { ProviderClass } from '@builderbot/bot'

export type BotCtxMiddleware = Partial<ProviderClass & { provider: any }>
