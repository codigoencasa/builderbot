const path = require('path')
const StormDB = require('stormdb')
const engine = new StormDB.localFileEngine(
    path.join(process.cwd(), './db.stormdb')
)

class JsonFileAdapter {
    db
    listHistory = []

    constructor() {
        this.init().then()
    }

    init() {
        return new Promise((resolve) => {
            this.db = new StormDB(engine)
            this.db.default({ history: [] })
            resolve(this.db)
        })
    }

    getPrevByNumber = async (from) => {
        const response = await this.db.get('history')
        const { history } = response.state

        if (!history.length) {
            return null
        }

        const result = history.filter((res) => res.from === from).pop()

        return {
            ...result,
        }
    }

    save = async (ctx) => {
        await this.db
            .get('history')
            .push({ ...ctx })
            .save()
        console.log('Guardado en DB...', ctx)
        this.listHistory.push(ctx)
    }
}

module.exports = JsonFileAdapter
