import type { RowDataPacket } from 'mysql2'

export interface MysqlAdapterCredentials {
    host: string
    user: string
    database: string
    password: string
    port: number
}

export interface HistoryRow extends RowDataPacket {
    id: number
    ref: string
    keyword: string | null
    answer: string
    refSerialize: string
    phone: string
    options: string
    created_at: Date
}
