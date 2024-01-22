import { existsSync, promises as fsPromises } from 'fs'
import { join } from 'path'

import { HistoryEntry, JsonFileAdapterOptions } from './types'

class JsonFileAdapter {
    private pathFile: string
    private listHistory: HistoryEntry[] = []
    private options: JsonFileAdapterOptions = { filename: 'db.json' }

    constructor(
        options: JsonFileAdapterOptions = {
            filename: 'de',
        }
    ) {
        this.options = { ...this.options, ...options }
        this.pathFile = join(process.cwd(), this.options.filename)
        this.init().then()
    }

    /**
     * Revisamos si existe o no el archivo JSON
     */
    private async init(): Promise<void> {
        if (existsSync(this.pathFile)) {
            return
        }
        try {
            const parseData = JSON.stringify([], null, 2)
            await fsPromises.writeFile(this.pathFile, parseData, 'utf-8')
        } catch (e) {
            throw new Error(e.message)
        }
    }

    /**
     * Validar JSON
     * @param raw
     */
    private validateJson(raw: string): any {
        try {
            return JSON.parse(raw)
        } catch (e) {
            return {}
        }
    }

    /**
     * Leer archivo y parsear
     */
    private async readFileAndParse(): Promise<HistoryEntry[]> {
        const data = await fsPromises.readFile(this.pathFile, 'utf-8')
        const parseData = this.validateJson(data)
        return parseData
    }

    /**
     * Buscar el último mensaje por número
     * @param from
     */
    async getPrevByNumber(from: string): Promise<HistoryEntry | undefined> {
        const history = await this.readFileAndParse()
        if (!history.length) {
            return undefined
        }

        const result = history
            .slice()
            .reverse()
            .filter((i) => !!i.keyword)
        return result.find((a) => a.from === from)
    }

    /**
     * Guardar dato
     * @param ctx
     */
    async save(ctx: HistoryEntry): Promise<void> {
        this.listHistory.push(ctx)
        const parseData = JSON.stringify(this.listHistory, null, 2)
        await fsPromises.writeFile(this.pathFile, parseData, 'utf-8')
    }
}

export { JsonFileAdapter }
