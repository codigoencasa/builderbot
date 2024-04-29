import type { GlobalVendorArgs } from '@builderbot/bot/dist/types'

interface Image {
    id?: string
    caption?: string
    link?: string
}

interface Video {
    id?: string
    caption?: string
    link?: string
}

interface TemplateMessage {
    name: string
    language: {
        code: string
    }
    components: TemplateComponent[]
}

interface TemplateComponent {
    type: 'header' | 'body' | 'button'
    parameters?: TemplateParameter[]
}

interface Section {
    title: string
    rows: Row[]
}

interface Row {
    id: string
    title: string
    description: string
}

interface TemplateParameter {
    type: string
}
export interface MediaResponse {
    url?: string
}

export interface MetaList {
    header: {
        type: string
        text: string
    }
    body: {
        text: string
    }
    footer: {
        text: string
    }
    action: {
        button: string
        sections: Section[]
    }
}

export interface MetaGlobalVendorArgs extends GlobalVendorArgs {
    jwtToken: string
    numberId: string
    verifyToken: string
    version: string
}

export interface Order {
    catalog_id: string
    product_items: string[]
}

export interface Contact {
    profile: Profile
    wa_id: string
    name: string
    phones: string[]
}

export interface Message {
    message_id?: string
    timestamp?: any
    type: string
    from: string
    to: string
    body: string
    pushName: string
    name: string
    url?: string
    payload?: string
    title_button_reply?: string
    title_list_reply?: string
    latitude?: number
    longitude?: number
    contacts?: Contact[]
    order?: Order
    id?: string
    caption?: string
}

export interface ParamsIncomingMessage {
    messageId?: string
    messageTimestamp?: any
    pushName: string
    to: string
    jwtToken: string
    numberId: string
    version: string
    message: any
}

export type TextGenericParams = {
    messaging_product: 'whatsapp'
    recipient_type: string
    to: string
    type: string
    [key: string]: any
}

export interface ParsedContact {
    name: {
        formatted_name: string
        first_name: string
        [key: string]: any
    }
    phones: {
        phone: string
        type: string
        [key: string]: any
    }[]
    [key: string]: any
}

export interface TextMessageBody {
    messaging_product: string
    to: string
    type: string
    recipient_type?: string
    text?: {
        preview_url: boolean
        body: string
    }
    image?: Image
    video?: Video
    interactive?: any
    contacts?: any[]
    template?: TemplateMessage
}

export interface Reaction {
    message_id: string
    emoji: string
}

export interface Localization {
    long_number: string
    lat_number: string
    name: string
    address: string
}

export interface SaveFileOptions {
    path?: string
}

export interface WhatsAppProfile {
    verified_name: string
    code_verification_status: string
    display_phone_number: string
    quality_rating: string
    platform_type: string
    throughput: {
        level: string
    }
    id: string
}

export interface IncomingMessage {
    object: string
    entry: Entry[]
}

export interface Entry {
    id: string
    changes: Change[]
}

export interface Change {
    value: Value
    field: string
}

export interface Value {
    messaging_product: string
    metadata: Metadata
    contacts: ContactMeta[]
    messages: MessageFromMeta[]
}

export interface Metadata {
    display_phone_number: string
    phone_number_id: string
}

export interface ContactMeta {
    profile: Profile
    wa_id: string
    name: string
    phones: string[]
}

export interface Profile {
    name: string
}

export interface MessageFromMeta {
    from: string
    id: string
    timestamp: string
    text: Text
    type: string
}

export interface Text {
    body: string
}
