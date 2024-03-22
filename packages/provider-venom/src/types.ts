import type { ProviderClass } from '@builderbot/bot'

export type BotCtxMiddleware = Partial<ProviderClass & { provider: any }>
export interface SaveFileOptions {
    path?: string
}
