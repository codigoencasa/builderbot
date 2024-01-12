import { ObjectId } from 'mongodb'

import mysql, { Connection, OkPacket, RowDataPacket } from 'mysql2'
export interface MongoAdapterCredentials {
    dbUri: string
    dbName: string
}

export interface History {
    from: string
    body: any
    keyword: string[]
    _id?: ObjectId
    date?: Date
}

export interface MysqlAdapterCredentials {
    host: string
    user: string
    database: string
    password: string
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
