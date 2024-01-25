export interface MediaResponse {
    url?: string
}
export interface Contact {
    name: string
    phones: string[]
}

export interface Order {
    catalog_id: string
    product_items: string[]
}

export interface Message {
    type: string
    from: string
    to: string
    body: string
    pushName: string
    url?: string
    payload?: string
    title_button_reply?: string
    title_list_reply?: string
    latitude?: number
    longitude?: number
    contacts?: Contact[]
    order?: Order
    id?: string
}

export interface ParamasIncomingMessage {
    pushName: string
    to: string
    jwtToken: string
    numberId: string
    version: string
    message: any
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
    image?: {
        id: string
    }
    video?: {
        id: string
    }
    interactive?: any
    contacts?: any[]
    template?: TemplateMessage
}

interface TemplateMessage {
    template: {
        name: string
        language: {
            code: string
        }
        components: TemplateComponent[]
    }
}

interface TemplateComponent {
    type: 'header' | 'body' | 'button'
    parameters: TemplateParameter[]
}

interface TemplateParameter {
    type: string
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

export interface MetaProviderOptions {
    jwtToken: string
    numberId: string
    verifyToken: string
    version: string
    port?: number
}
