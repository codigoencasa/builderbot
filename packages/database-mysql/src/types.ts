/**
 * LAYER: Domain
 * Contains: MysqlAdapterCredentials, HistoryRow, RowDataPacket
 * Rules: No external dependencies. Pure business logic.
 * BigO: O(1) score:5
 * keywords: [MysqlAdapterCredentials, HistoryRow, RowDataPacket]
 * GOAL: Own the "types" concern of the database-mysql package.
 */
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
