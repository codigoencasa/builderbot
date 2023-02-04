const { MongoClient } = require('mongodb')

class MongoAdapter {
    db
    listHistory = []
    credentials = { dbUri: null, dbName: null }
    constructor(_credentials) {
        this.credentials = _credentials
        this.init().then()
    }

    init = async () => {
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

    getPrevByNumber = async (from) => {
        const result = await this.db.collection('history').find({ from }).sort({ _id: -1 }).limit(1).toArray()
        return result[0]
    }

    save = async (ctx) => {
        await this.db.collection('history').insert(ctx)
        console.log('Guardando DB...', ctx)
        this.listHistory.push(ctx)
    }
}

module.exports = MongoAdapter
