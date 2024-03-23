import type { SendOptions, BotContext, Button } from '@builderbot/bot/dist/types'

import type {
    TextMessageBody,
    Reaction,
    Localization,
    Message,
    SaveFileOptions,
    MetaList,
    TextGenericParams,
} from '../types'

export interface MetaInterface {
    sendMessageMeta: (body: TextMessageBody) => void
    sendMessageToApi: (body: TextMessageBody) => Promise<any>
    sendText: (to: string, message: string) => Promise<any>
    sendImage: (to: string, mediaInput: string | null, caption: string) => Promise<any>
    sendVideo: (to: string, pathVideo: string | null, caption: string) => Promise<any>
    sendMedia: (to: string, text: string, mediaInput: string) => Promise<any>
    sendList: (to: string, list: MetaList) => Promise<any>
    sendButtons: (to: string, buttons: Button[], text: string) => Promise<any>
    sendButtonUrl: (to: string, button: Button & { url: string }, text: string) => Promise<any>
    sendTemplate: (number: any, template: TextGenericParams) => Promise<any>
    sendContacts: (to: string, contact: any[]) => Promise<any>
    sendCatalog: (number: any, bodyText: any, itemCatalogId: any) => Promise<any>
    sendMessage: (number: string, message: string, options?: SendOptions) => Promise<any>
    sendReaction: (number: string, react: Reaction) => Promise<any>
    sendLocation: (to: string, localization: Localization) => Promise<any>
    saveFile: (ctx: Partial<Message & BotContext>, options?: SaveFileOptions) => Promise<string>
    sendFile: (to: string, mediaInput: string | null, caption: string) => Promise<any>
    sendAudio: (to: string, fileOpus: string) => void
}
