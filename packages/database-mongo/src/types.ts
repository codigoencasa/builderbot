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
