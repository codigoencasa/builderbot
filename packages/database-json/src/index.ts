import { MemoryDB } from '@builderbot/bot'
import { existsSync, promises as fsPromises } from 'fs'
import { join } from 'path'

import type { HistoryEntry, JsonFileAdapterOptions } from './types'

class JsonFileDB extends MemoryDB {
    private pathFile: string
    private tempPath: string
    listHistory: HistoryEntry[] = []
    private options: JsonFileAdapterOptions = { filename: 'db.json', debounceTime: 0 }
    private initPromise: Promise<void> | null = null
    private writeQueue: Promise<void> = Promise.resolve()
    private debounceTimer: ReturnType<typeof setTimeout> | null = null
    private pendingWrite: Promise<void> | null = null
    private pendingWriteResolvers: Array<() => void> = []

    constructor(
        options: JsonFileAdapterOptions = {
            filename: 'db.json',
        }
    ) {
        super()
        this.options = { ...this.options, ...options }
        this.pathFile = join(process.cwd(), this.options.filename)
        this.tempPath = `${this.pathFile}.tmp`
        this.initPromise = this.init()
    }

    /**
     * Revisamos si existe o no el archivo JSON y cargamos el historial
     */
    private async init(): Promise<void> {
        try {
            // Limpiar archivo temporal si existe (de crash anterior)
            if (existsSync(this.tempPath)) {
                try {
                    await fsPromises.unlink(this.tempPath)
                } catch {
                    // Ignorar error al limpiar temp
                }
            }

            if (!existsSync(this.pathFile)) {
                const parseData = JSON.stringify([], null, 2)
                await fsPromises.writeFile(this.pathFile, parseData, 'utf-8')
                this.listHistory = []
            } else {
                // Cargar historial existente del archivo
                const data = await fsPromises.readFile(this.pathFile, 'utf-8')
                this.listHistory = this.validateJson(data)
            }
        } catch (e) {
            console.error('[JsonFileDB] Error initializing database:', e.message)
            this.listHistory = []
        }
    }

    /**
     * Esperar a que la inicialización termine
     */
    private async waitForInit(): Promise<void> {
        if (this.initPromise) {
            await this.initPromise
        }
    }

    /**
     * Validar JSON - retorna array vacío si el JSON es inválido
     * @param raw
     */
    private validateJson(raw: string): HistoryEntry[] {
        try {
            const parsed = JSON.parse(raw)
            // Asegurar que sea un array
            if (Array.isArray(parsed)) {
                return parsed
            }
            console.warn('[JsonFileDB] Database file contains invalid data (not an array), starting fresh')
            return []
        } catch (e) {
            console.warn('[JsonFileDB] Database file corrupted, starting fresh:', e.message)
            return []
        }
    }

    /**
     * Leer archivo y parsear (siempre desde memoria después de init)
     */
    private async readFileAndParse(): Promise<HistoryEntry[]> {
        await this.waitForInit()
        return this.listHistory
    }

    /**
     * Escribir al archivo de forma atómica (write to temp, then rename)
     * Esto previene corrupción si el proceso se interrumpe durante la escritura
     */
    private async atomicWrite(): Promise<void> {
        try {
            const parseData = JSON.stringify(this.listHistory, null, 2)
            // Escribir a archivo temporal
            await fsPromises.writeFile(this.tempPath, parseData, 'utf-8')
            // Renombrar atómicamente (esto es una operación atómica en la mayoría de sistemas)
            await fsPromises.rename(this.tempPath, this.pathFile)
        } catch (e) {
            console.error('[JsonFileDB] Error writing to database:', e.message)
            // Intentar limpiar archivo temporal
            try {
                if (existsSync(this.tempPath)) {
                    await fsPromises.unlink(this.tempPath)
                }
            } catch {
                // Ignorar error de limpieza
            }
        }
    }

    /**
     * Escribir al archivo de forma segura con cola y debounce opcional
     */
    private async safeWrite(): Promise<void> {
        const debounceTime = this.options.debounceTime || 0

        if (debounceTime > 0) {
            // Con debounce: agrupar múltiples escrituras
            return new Promise<void>((resolve) => {
                this.pendingWriteResolvers.push(resolve)

                if (this.debounceTimer) {
                    clearTimeout(this.debounceTimer)
                }

                this.debounceTimer = setTimeout(async () => {
                    this.debounceTimer = null
                    const resolvers = [...this.pendingWriteResolvers]
                    this.pendingWriteResolvers = []

                    this.writeQueue = this.writeQueue.then(async () => {
                        await this.atomicWrite()
                        resolvers.forEach((r) => r())
                    })

                    await this.writeQueue
                }, debounceTime)
            })
        } else {
            // Sin debounce: escritura inmediata en cola
            this.writeQueue = this.writeQueue.then(async () => {
                await this.atomicWrite()
            })
            return this.writeQueue
        }
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
        await this.waitForInit()
        this.listHistory.push(ctx)
        await this.safeWrite()
    }
}

export { JsonFileDB }
