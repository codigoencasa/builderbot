export type HistoryEntry = {
    ref: string
    keyword?: string
    answer: string
    refSerialize: string
    phone: string
    options?: Record<string, any>
}

export interface Credential {
    host: string
    user: string
    database: string
    password: any
    port: number
}

export interface Contact {
    id: number
    phone: string
    created_at: string
    updated_in?: string | null
    last_interaction?: string | null
    values: Record<string, any>
}
