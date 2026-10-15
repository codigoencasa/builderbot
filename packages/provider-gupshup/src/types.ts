/**
 * LAYER: Domain
 * Contains: GupshupStatusLogMode, GupshupLogsConfig, GupshupLocalMediaConfig, GupshupGlobalVendorArgs
 * Rules: No external dependencies. Pure business logic.
 * BigO: O(1) score:5
 * keywords: [GupshupStatusLogMode, GupshupLogsConfig, GupshupLocalMediaConfig, GupshupGlobalVendorArgs]
 * GOAL: Own the "types" concern of the provider-gupshup package.
 */
import { GlobalVendorArgs } from '@builderbot/bot/dist/types'

export type GupshupStatusLogMode = 'off' | 'failed' | 'all'

export interface GupshupLogsConfig {
    inbound?: boolean
    status?: GupshupStatusLogMode
    outboundErrors?: boolean
    rawOnFailed?: boolean
}

export interface GupshupLocalMediaConfig {
    ttlMs?: number
}

export interface GupshupGlobalVendorArgs extends GlobalVendorArgs {
    apiKey: string
    srcName: string // Nombre de la App en Gupshup
    phoneNumber: string // Número origen (Source)
    appId?: string
    partner?: {
        appId?: string
        appToken?: string
        baseUrl?: string
    }
    publicUrl?: string
    logs?: GupshupLogsConfig
    localMedia?: GupshupLocalMediaConfig
    resolveMediaUrl?: (input: string) => Promise<string> | string
    webhook?: {
        verify?: (req: any) => boolean | Promise<boolean>
        dedupeTtlMs?: number
    }
}

export type GupshupCloudMessageType =
    | 'text'
    | 'image'
    | 'document'
    | 'audio'
    | 'video'
    | 'sticker'
    | 'location'
    | 'button'
    | 'interactive'
    | 'contacts'
    | 'order'
    | 'reaction'
    | string

export interface GupshupCloudContact {
    wa_id?: string
    profile?: {
        name?: string
    }
}

export interface GupshupCloudMetadata {
    display_phone_number?: string
    phone_number_id?: string
}

export interface GupshupCloudMedia {
    id?: string
    url?: string
    mime_type?: string
    sha256?: string
    filename?: string
    caption?: string
}

export interface GupshupCloudLocation {
    latitude?: number | string
    longitude?: number | string
    name?: string
    address?: string
}

export interface GupshupCloudContactCard {
    name?: {
        formatted_name?: string
        first_name?: string
        last_name?: string
    }
    phones?: Array<{
        phone?: string
        wa_id?: string
        type?: string
    }>
}

export interface GupshupCloudOrder {
    catalog_id?: string
    product_items?: Array<{
        product_retailer_id?: string
        quantity?: number | string
        item_price?: number | string
        currency?: string
    }>
}

export interface GupshupCloudReaction {
    message_id?: string
    emoji?: string
}

export interface GupshupCloudInteractiveMessage {
    type?: 'button_reply' | 'list_reply' | string
    button_reply?: {
        id?: string
        title?: string
    }
    list_reply?: {
        id?: string
        title?: string
        description?: string
    }
    nfm_reply?: {
        name?: string
        body?: string
        response_json?: string
    }
}

export interface GupshupCloudMessage {
    id?: string
    from?: string
    timestamp?: string
    type?: GupshupCloudMessageType
    text?: {
        body?: string
    }
    image?: GupshupCloudMedia
    document?: GupshupCloudMedia
    audio?: GupshupCloudMedia
    video?: GupshupCloudMedia
    sticker?: GupshupCloudMedia
    location?: GupshupCloudLocation
    button?: {
        payload?: string
        text?: string
    }
    interactive?: GupshupCloudInteractiveMessage
    contacts?: GupshupCloudContactCard[]
    order?: GupshupCloudOrder
    reaction?: GupshupCloudReaction
}

export interface GupshupCloudStatusError {
    code?: number | string
    title?: string
    details?: string
    message?: string
    error_data?: {
        details?: string
    }
}

export interface GupshupCloudStatus {
    id?: string
    gs_id?: string
    recipient_id?: string
    status?: string
    timestamp?: number | string
    errors?: GupshupCloudStatusError[]
}

export interface GupshupCloudChangeValue {
    metadata?: GupshupCloudMetadata
    contacts?: GupshupCloudContact[]
    messages?: GupshupCloudMessage[]
    statuses?: GupshupCloudStatus[]
}

export interface GupshupCloudWebhookBody {
    object?: string
    gs_app_id?: string
    entry?: Array<{
        id?: string
        changes?: Array<{
            field?: string
            value?: GupshupCloudChangeValue
        }>
    }>
}

export interface GupshupCloudIncomingMessageArgs {
    message: GupshupCloudMessage
    contact?: GupshupCloudContact
    metadata?: GupshupCloudMetadata
}

export type GupshupSessionMediaType = 'image' | 'video' | 'audio' | 'file' | 'sticker'

export interface GupshupReactionMessage {
    msgId?: string
    messageId?: string
    message_id?: string
    emoji: string
}

export interface GupshupLocationMessage {
    longitude: string | number
    latitude: string | number
    name?: string
    address?: string
}

export interface GupshupLocationRequestMessage {
    bodyText: string
}

export interface GupshupListOption {
    title: string
    description?: string
    postbackText?: string
    encodeText?: boolean
}

export interface GupshupListItem {
    title?: string
    options: GupshupListOption[]
}

export interface GupshupListMessage {
    title?: string
    body?: string
    msgid?: string
    buttonTitle?: string
    items: GupshupListItem[]
}

export interface GupshupMetaListRow {
    id: string
    title: string
    description?: string
}

export interface GupshupMetaListSection {
    title: string
    rows: GupshupMetaListRow[]
}

export interface GupshupMetaListMessage {
    type: 'list'
    header?: {
        type?: 'text'
        text: string
    }
    body: {
        text: string
    }
    action: {
        button: string
        sections: GupshupMetaListSection[]
    }
    footer?: {
        text: string
    }
}

export type GupshupCompatibleListMessage = GupshupListMessage | GupshupMetaListMessage

export interface GupshupCtaHeader {
    type?: 'image' | 'video'
    image?: {
        link?: string
    }
    video?: {
        link?: string
    }
}

export interface GupshupCtaMessage {
    display_text: string
    url: string
    body?: string
    footer?: string
    header?: GupshupCtaHeader
}

export interface GupshupTemplatePayload {
    id: string
    languageCode?: string
    params?: string[]
}

export interface GupshupMetaTemplateComponentParameter {
    type?: string
    text?: string
    payload?: string
    [key: string]: unknown
}

export interface GupshupMetaTemplateComponent {
    type?: string
    parameters?: GupshupMetaTemplateComponentParameter[]
    [key: string]: unknown
}

export type GupshupTemplateLanguageOrComponents = string | GupshupMetaTemplateComponent[]

export interface GupshupTemplateMessage {
    type: 'image' | 'video' | 'document' | 'location'
    image?: {
        id?: string
        link?: string
    }
    video?: {
        id?: string
        link?: string
    }
    document?: {
        id?: string
        link?: string
        filename?: string
    }
    location?: {
        longitude: string | number
        latitude: string | number
        name?: string
        address?: string
    }
}

export interface GupshupTemplateSendRequest {
    template: GupshupTemplatePayload
    message?: GupshupTemplateMessage
    postbackTexts?: string[]
}

export interface GupshupFlowSendRequest {
    header?: string
    body?: string
    footer?: string
    flowMessageVersion?: string
    flowToken?: string
    flowId?: string
    flowCta?: string
    flowAction?: string
    flowActionPayload?: Record<string, unknown>
    isDraftFlow?: boolean
}

export interface GupshupMetaTemplatePassthroughRequest {
    name: string
    language: string | Record<string, unknown>
    components?: GupshupMetaTemplateComponent[]
}

export interface GupshupSessionSendOptions {
    mediaType?: GupshupSessionMediaType
    previewUrl?: boolean
    replyTo?: string
    filename?: string
    list?: GupshupCompatibleListMessage
    reaction?: GupshupReactionMessage
    location?: GupshupLocationMessage
    locationRequest?: string | GupshupLocationRequestMessage
    ctaUrl?: GupshupCtaMessage
    flow?: GupshupFlowSendRequest
    template?: GupshupTemplateSendRequest
    templatePassthrough?: GupshupMetaTemplatePassthroughRequest
    options?: Record<string, unknown>
}
