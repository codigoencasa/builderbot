import { MongoClient, Db } from 'mongodb'

import { History, MongoAdapterCredentials } from './types'

class MongoAdapter {
    db: Db | null = null
    listHistory: History[] = []
    credentials: MongoAdapterCredentials = { dbUri: null, dbName: null }
    constructor(_credentials: MongoAdapterCredentials) {
        this.credentials = _credentials
        this.init().then()
    }

    init = async (): Promise<boolean> => {
        try {
            const client = new MongoClient(this.credentials.dbUri, {})
            await client.connect()
            console.log('🆗 Conexión Correcta DB')
            const db = client.db(this.credentials.dbName)
            this.db = db
            return true
        } catch (e) {
            console.log('Error', e)
            return
        }
    }

    getPrevByNumber = async (from: string): Promise<any> => {
        const result = await this.db.collection('history').find({ from }).sort({ _id: -1 }).limit(1).toArray()
        return result[0]
    }

    save = async (ctx: History): Promise<void> => {
        const ctxWithDate = {
            ...ctx,
            date: new Date(),
        }
        await this.db.collection('history').insertOne(ctxWithDate)

        this.listHistory.push(ctx)
    }
}

export { MongoAdapter }
