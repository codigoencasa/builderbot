const { join } = require('path')
const { existsSync } = require('fs')
const { writeFile, readFile } = require('fs').promises

class JsonFileAdapter {
    db
    pathFile
    listHistory = []
    options = { filename: 'db.json' }

    constructor(options = {}) {
        this.options = { ...this.options, ...options }
        this.pathFile = join(process.cwd(), this.options.filename)
        this.init().then()
    }

    /**
     * Revisamos si existe o no el json file
     * @returns
     */
    init = async () => {
        if (existsSync(this.pathFile)) {
            return Promise.resolve()
        }
        try {
            const parseData = JSON.stringify([], null, 2)
            return writeFile(this.pathFile, parseData, 'utf-8')
        } catch (e) {
            return Promise.reject(e.message)
        }
    }

    validateJson = (raw) => {
        try {
            return JSON.parse(raw)
        } catch (e) {
            return {}
        }
    }

    /**
     * Leer archivo y parsear
     * @returns
     */
    readFileAndParse = async () => {
        const data = await readFile(this.pathFile, 'utf-8')
        const parseData = this.validateJson(data)
        return parseData
    }

    /**
     * Buscamos el ultimo mensaje por numero
     * @param {*} from
     * @returns
     */
    getPrevByNumber = async (from) => {
        const history = await this.readFileAndParse()
        if (!history.length) {
            return []
        }

        const result = history
            .slice()
            .reverse()
            .filter((i) => !!i.keyword)
        return result.find((a) => a.from === from)
    }

    /**
     * Guardar dato
     * @param {*} ctx
     */
    save = async (ctx) => {
        this.listHistory.push(ctx)
        const parseData = JSON.stringify(this.listHistory, null, 2)
        await writeFile(this.pathFile, parseData, 'utf-8')
    }
}

module.exports = JsonFileAdapter
