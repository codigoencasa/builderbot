import type { ProviderClass } from '@builderbot/bot'
export interface Response {
    type: string
    data: Buffer
}

export type BotCtxMiddleware = Partial<ProviderClass & { provider: any }>

export interface SaveFileOptions {
    path?: string
}
