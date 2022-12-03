const Path = require('path')
const StormDB = require('stormdb')
const engine = new StormDB.localFileEngine(Path.join(__dirname, './db.stormdb'))

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
            options: JSON.parse(result.options),
        }
    }

    save = async (ctx) => {
        await this.db
            .get('history')
            .push({ ...ctx, options: JSON.stringify(ctx.options) })
            .save()
        console.log('Guardado en DB...', ctx)
        this.listHistory.push(ctx)
    }
}

module.exports = JsonFileAdapter
