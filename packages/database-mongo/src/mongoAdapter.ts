/**
 * LAYER: Infrastructure
 * Contains: MemoryDB, MongoClient, History, MongoAdapterCredentials
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(n log n) score:2
 * keywords: [MemoryDB, MongoClient, History, MongoAdapterCredentials]
 * GOAL: Own the "mongo adapter" concern of the database-mongo package.
 */
import { MemoryDB } from '@builderbot/bot'
import type { Db } from 'mongodb'
import { MongoClient } from 'mongodb'

import type { History, MongoAdapterCredentials } from './types'

class MongoAdapter extends MemoryDB {
    client: MongoClient | null = null
    db: Db | null = null
    listHistory: History[] = []
    credentials: MongoAdapterCredentials = { dbUri: null, dbName: null }

    constructor(_credentials: MongoAdapterCredentials) {
        super()
        this.credentials = _credentials
        this.init().then()
    }

    init = async (): Promise<boolean> => {
        try {
            if (!this.client) {
                this.client = new MongoClient(this.credentials.dbUri, {})
            }

            await this.client.connect()

            console.log(`🆗 Connection successfully established`)
            const db = this.client.db(this.credentials.dbName)
            this.db = db
            return true
        } catch (e) {
            console.log('Error', e)
            return false
        }
    }

    close = async (): Promise<void> => {
        if (!this.client) {
            return
        }

        await this.client.close()
        this.client = null
        this.db = null
    }

    getPrevByNumber = async (from: string): Promise<any> => {
        const result = await this.db.collection('history').find({ from }).sort({ _id: -1 }).limit(1).toArray()
        return result[0]
    }

    save = async (ctx: History): Promise<void> => {
        this.listHistory.push(ctx)
        const ctxWithDate = {
            ...ctx,
            date: new Date(),
        }
        await this.db.collection('history').insertOne(ctxWithDate)
    }
}

export { MongoAdapter }
