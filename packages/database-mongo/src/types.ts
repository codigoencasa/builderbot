/**
 * LAYER: Domain
 * Contains: MongoAdapterCredentials, History, ObjectId
 * Rules: No external dependencies. Pure business logic.
 * BigO: O(1) score:5
 * keywords: [MongoAdapterCredentials, History, ObjectId]
 * GOAL: Own the "types" concern of the database-mongo package.
 */
import type { ObjectId } from 'mongodb'

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
