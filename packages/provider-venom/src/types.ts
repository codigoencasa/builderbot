import { ProviderClass } from '@bot-whatsapp/bot'

export type BotCtxMiddleware = Partial<ProviderClass & { provider: any }>
