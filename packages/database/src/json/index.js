const { join } = require('path')
const { existsSync, writeFileSync, readFileSync } = require('fs')

class JsonFileAdapter {
    db
    pathFile
    listHistory = []

    constructor() {
        this.pathFile = join(process.cwd(), 'db.json')
        this.init().then()
    }

    databaseExists() {
        return existsSync(this.pathFile)
    }

    async init() {
        const dbExists = await this.databaseExists()

        if (!dbExists) {
            const data = {
                history: [],
            }
            await this.saveData(data)
        }
    }

    readDatabase() {
        const db = readFileSync(this.pathFile)
        return JSON.parse(db)
    }

    saveData(data) {
        writeFileSync(this.pathFile, JSON.stringify(data, null, 2))
    }

    getPrevByNumber = async (from) => {
        const { history } = await this.readDatabase()

        if (!history.length) {
            return null
        }

        const result = history.filter((res) => res.from === from).pop()

        return {
            ...result,
        }
    }

    save = async (ctx) => {
        this.db = await this.readDatabase()

        this.db.history.push(ctx)

        await this.saveData(this.db)

        this.listHistory.push(ctx)
        console.log('Guardado en DB...', ctx)
    }
}

module.exports = JsonFileAdapter
