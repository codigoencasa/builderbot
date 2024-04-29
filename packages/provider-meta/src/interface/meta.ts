import type { SendOptions, BotContext, Button } from '@builderbot/bot/dist/types'

import type { TextMessageBody, Reaction, Localization, Message, SaveFileOptions, MetaList } from '~/types'

export interface MetaInterface {
    sendMessageMeta: (body: TextMessageBody) => void
    sendMessageToApi: (body: TextMessageBody) => Promise<any>
    sendText: (to: string, message: string) => Promise<any>
    sendImage: (to: string, mediaInput: string | null, caption: string) => Promise<any>
    sendImageUrl: (to: string, url: string, caption: string) => Promise<void>
    sendVideo: (to: string, pathVideo: string | null, caption: string) => Promise<any>
    sendVideoUrl: (to: string, url: string, caption: string) => Promise<void>
    sendMedia: (to: string, text: string, mediaInput: string) => Promise<any>
    sendList: (to: string, list: MetaList) => Promise<any>
    sendListComplete: (
        to: string,
        header: string,
        text: string,
        footer: string,
        button: string,
        list: Record<string, any>
    ) => Promise<void>
    sendButtons: (to: string, buttons: Button[], text: string) => Promise<any>
    sendButtonUrl: (to: string, button: Button & { url: string }, text: string) => Promise<any>
    sendButtonsMedia: (
        to: string,
        media_type: string,
        buttons: Button[],
        text: string,
        mediaInput: string
    ) => Promise<any>
    sendTemplate: (to: string, template: string, languageCode: string, components: Record<string, any>) => Promise<any>
    sendFlow: (
        to: string,
        headerText: string,
        bodyText: string,
        footerText: string,
        flowID: string,
        flowCta: string,
        screenName: string,
        data: Record<string, any>
    ) => Promise<void>
    sendContacts: (to: string, contact: any[]) => Promise<any>
    sendCatalog: (number: any, bodyText: any, itemCatalogId: any) => Promise<any>
    sendMessage: (number: string, message: string, options?: SendOptions) => Promise<any>
    sendReaction: (number: string, react: Reaction) => Promise<any>
    sendLocation: (to: string, localization: Localization) => Promise<any>
    sendLocationRequest: (to: string, bodyText: string) => Promise<any>
    saveFile: (ctx: Partial<Message & BotContext>, options?: SaveFileOptions) => Promise<string>
    sendFile: (to: string, mediaInput: string | null, caption: string) => Promise<any>
    sendAudio: (to: string, fileOpus: string) => void
}
