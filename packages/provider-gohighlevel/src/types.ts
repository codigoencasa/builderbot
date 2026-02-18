import type { GlobalVendorArgs } from '@builderbot/bot/dist/types'

export type GHLChannelType = 'SMS' | 'WhatsApp' | 'Email' | 'Live_Chat' | 'Facebook' | 'Instagram' | 'Custom'

export interface GHLGlobalVendorArgs extends GlobalVendorArgs {
    clientId: string
    clientSecret: string
    locationId: string
    channelType: GHLChannelType
    apiVersion: string
    redirectUri?: string
    accessToken?: string
    refreshToken?: string
    conversationProviderId?: string
    /** Optional webhook secret for signature verification (HMAC SHA256) */
    webhookSecret?: string
}

export interface GHLOAuthTokens {
    access_token: string
    refresh_token: string
    token_type: string
    expires_in: number
    scope: string
    locationId: string
    userId?: string
}

export interface GHLContact {
    id: string
    name?: string
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    locationId?: string
    [key: string]: any
}

export interface GHLConversation {
    id: string
    contactId: string
    locationId: string
    type?: string
    [key: string]: any
}

export interface GHLMessage {
    type: string
    from: string
    to: string
    body: string
    name: string
    pushName: string
    message_id?: string
    timestamp?: any
    url?: string
    attachments?: GHLAttachment[]
    contactId?: string
    conversationId?: string
    channelType?: GHLChannelType
    direction?: 'inbound' | 'outbound'
}

export interface GHLAttachment {
    url: string
    type?: string
    name?: string
    size?: number
}

export interface GHLSendMessageBody {
    type: GHLChannelType
    contactId: string
    message?: string
    html?: string
    subject?: string
    attachments?: string[]
    conversationProviderId?: string
}

export interface GHLIncomingWebhook {
    type: string
    locationId: string
    contactId?: string
    conversationId?: string
    messageId?: string
    body?: string
    messageType?: string
    phone?: string
    email?: string
    direction?: 'inbound' | 'outbound'
    status?: string
    attachments?: GHLAttachment[]
    dateAdded?: string
    [key: string]: any
}

export interface GHLContactSearchResult {
    contacts: GHLContact[]
    meta?: {
        total: number
        currentPage: number
        nextPage: number | null
    }
}

export interface SaveFileOptions {
    path?: string
}
