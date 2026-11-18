export interface RedisAdapterCredentials {
    expire?: number | null
    store_messages?: number | null
    prefix?: string | null
}

export interface History {
    from: string
    body: any
    keyword: string[]
    date?: Date
}
