require('dotenv').config()
const { MongoClient } = require('mongodb')

const DB_URI = process.env.DB_URI || 'mongodb://0.0.0.0:27017'
const DB_NAME = process.env.DB_NAME || 'db_bot'

class MongoAdapter {
    db
    listHistory = []

    constructor() {
        this.init().then()
    }

    init = async () => {
        try {
            const client = new MongoClient(DB_URI, {})
            await client.connect()
            console.log('🆗 Conexión Correcta DB')
            const db = client.db(DB_NAME)
            this.db = db
            return true
        } catch (e) {
            console.log('Error', e)
            return
        }
    }

    getPrevByNumber = async (from) => {
        const result = await this.db
            .collection('history')
            .find({ from })
            .sort({ _id: -1 })
            .limit(1)
            .toArray()
        return result[0]
    }

    save = async (ctx) => {
        await this.db.collection('history').insert(ctx)
        console.log('Guardando DB...', ctx)
        this.listHistory.push(ctx)
    }
}

module.exports = MongoAdapter
