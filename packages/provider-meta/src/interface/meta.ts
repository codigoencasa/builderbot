/**
 * LAYER: Interface
 * Contains: MetaInterface — the public contract the MetaProvider implements
 * Rules: Type-level contract only. Depends on Domain types; no runtime logic.
 * BigO: O(1) score:5
 * keywords: [MetaInterface, MetaProvider, SendOptions]
 * GOAL: Declare the operations (send text/media/list, reactions, orders) the Meta provider must expose.
 */
import type { SendOptions, BotContext, Button } from '@builderbot/bot/dist/types'

import type {
    TextMessageBody,
    Reaction,
    Localization,
    Message,
    SaveFileOptions,
    MetaList,
    Order,
    MetaOrderDetails,
} from '~/types'

export interface MetaInterface {
    sendMessageMeta: (body: TextMessageBody) => void
    sendMessageToApi: (body: TextMessageBody) => Promise<any>
    sendText: (to: string, message: string, context: string | null, preview_url?: boolean) => Promise<any>
    sendImage: (to: string, mediaInput: string | null, caption: string, context: string | null) => Promise<any>
    sendImageUrl: (to: string, url: string, caption: string, context: string | null) => Promise<void>
    sendVideo: (to: string, pathVideo: string | null, caption: string, context: string | null) => Promise<any>
    sendVideoUrl: (to: string, url: string, caption: string, context: string | null) => Promise<void>
    sendMedia: (to: string, text: string, mediaInput: string, context: string | null) => Promise<any>
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
        flowMessageVer: string,
        flowAction: string,
        flowID: string,
        flowToken: string,
        flowCta: string,
        isDraftFlow: boolean,
        screenName: string,
        data: Record<string, any>
    ) => Promise<void>
    sendContacts: (to: string, contact: any[]) => Promise<any>
    sendCatalog: (number: any, bodyText: any, itemCatalogId: any) => Promise<any>
    sendMessage: (number: string, message: string, options?: SendOptions, context?: string) => Promise<any>
    sendReaction: (number: string, react: Reaction) => Promise<any>
    sendLocation: (to: string, localization: Localization, context: string | null) => Promise<any>
    sendLocationRequest: (to: string, bodyText: string, context: string | null) => Promise<any>
    saveFile: (ctx: Partial<Message & BotContext>, options?: SaveFileOptions) => Promise<string>
    sendFile: (to: string, mediaInput: string | null, caption: string, context: string | null) => Promise<any>
    sendAudio: (to: string, fileOpus: string, context: string | null) => void
    markAsRead: (wa_id: string) => Promise<any>
    sendPresenceUpdate: (messageId: string) => Promise<any>
    typing: (messageId: string, ms?: number) => Promise<void>
    getOrderDetails: (order: Order) => Promise<MetaOrderDetails>
}
