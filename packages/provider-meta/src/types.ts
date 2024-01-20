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
