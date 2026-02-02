import { MemoryDB } from '@builderbot/bot'
import { existsSync, promises as fsPromises } from 'fs'
import { join } from 'path'

import type { HistoryEntry, JsonFileAdapterOptions } from './types'

const MAX_RETRIES = 3
const RETRY_BASE_MS = 50
const LOCK_STALE_MS = 10_000

class JsonFileDB extends MemoryDB {
    private pathFile: string
    private tempPath: string
    private lockPath: string
    listHistory: HistoryEntry[] = []
    private options: JsonFileAdapterOptions = { filename: 'db.json', debounceTime: 0 }
    private initPromise: Promise<void> | null = null
    private writeQueue: Promise<void> = Promise.resolve()
    private debounceTimer: ReturnType<typeof setTimeout> | null = null
    private pendingWrite: Promise<void> | null = null
    private pendingWriteResolvers: Array<{ resolve: () => void; reject: (err: Error) => void }> = []

    constructor(
        options: JsonFileAdapterOptions = {
            filename: 'db.json',
        }
    ) {
        super()
        this.options = { ...this.options, ...options }
        this.pathFile = join(process.cwd(), this.options.filename)
        this.tempPath = `${this.pathFile}.tmp`
        this.lockPath = `${this.pathFile}.lock`
        this.initPromise = this.init()
    }

    /**
     * Revisamos si existe o no el archivo JSON y cargamos el historial.
     * Si existe un archivo temporal de un crash anterior, intentamos recuperar los datos.
     */
    private async init(): Promise<void> {
        try {
            await this.recoverFromTempFile()

            if (!existsSync(this.pathFile)) {
                await fsPromises.writeFile(this.pathFile, '[]', 'utf-8')
                this.listHistory = []
            } else {
                const data = await fsPromises.readFile(this.pathFile, 'utf-8')
                this.listHistory = this.validateJson(data)
            }
        } catch (e) {
            console.error('[JsonFileDB] Error initializing database:', e.message)
            this.listHistory = []
        }
    }

    /**
     * Intenta recuperar datos de un archivo temporal dejado por un crash anterior.
     * Si el temp tiene datos válidos con más entradas que el archivo principal, los usa.
     */
    private async recoverFromTempFile(): Promise<void> {
        if (!existsSync(this.tempPath)) return

        try {
            const tempData = await fsPromises.readFile(this.tempPath, 'utf-8')
            const tempEntries = this.validateJson(tempData)

            if (tempEntries.length > 0) {
                let currentEntries: HistoryEntry[] = []
                if (existsSync(this.pathFile)) {
                    const currentData = await fsPromises.readFile(this.pathFile, 'utf-8')
                    currentEntries = this.validateJson(currentData)
                }

                // Si el temp tiene más datos, probablemente el crash ocurrió entre write y rename
                if (tempEntries.length >= currentEntries.length) {
                    await fsPromises.rename(this.tempPath, this.pathFile)
                    console.log('[JsonFileDB] Recovered data from temp file')
                    return
                }
            }
        } catch {
            // Si falla la recuperación, continuamos normalmente
        }

        // Limpiar temp si no se pudo recuperar
        try {
            await fsPromises.unlink(this.tempPath)
        } catch {
            // Ignorar error al limpiar
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
     */
    private validateJson(raw: string): HistoryEntry[] {
        try {
            const parsed = JSON.parse(raw)
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
     * Adquirir un lock de archivo simple para evitar escrituras concurrentes entre instancias.
     * Usa wx (exclusive create) que es atómico en la mayoría de filesystems.
     */
    private async acquireLock(retries = 5): Promise<void> {
        for (let i = 0; i < retries; i++) {
            try {
                const lockData = JSON.stringify({ pid: process.pid, ts: Date.now() })
                await fsPromises.writeFile(this.lockPath, lockData, { flag: 'wx' })
                return
            } catch {
                // Lock existe, verificar si es stale
                try {
                    const lockContent = await fsPromises.readFile(this.lockPath, 'utf-8')
                    const lockInfo = JSON.parse(lockContent)
                    if (Date.now() - lockInfo.ts > LOCK_STALE_MS) {
                        // Lock stale, forzar remoción
                        await fsPromises.unlink(this.lockPath)
                        continue
                    }
                } catch {
                    // Lock corrupto o eliminado, reintentar
                    try {
                        await fsPromises.unlink(this.lockPath)
                    } catch {
                        // ignorar
                    }
                    continue
                }

                // Esperar antes de reintentar
                await new Promise((r) => setTimeout(r, RETRY_BASE_MS * (i + 1)))
            }
        }
        // Si no conseguimos el lock después de los reintentos, procedemos igual
        // para no bloquear la aplicación
        console.warn('[JsonFileDB] Could not acquire lock, proceeding anyway')
    }

    /**
     * Liberar el lock de archivo
     */
    private async releaseLock(): Promise<void> {
        try {
            await fsPromises.unlink(this.lockPath)
        } catch {
            // Ignorar si ya fue eliminado
        }
    }

    /**
     * Escribir al archivo de forma atómica con fsync y verificación.
     * 1. Adquirir lock
     * 2. Serializar datos
     * 3. Escribir a temp + fsync
     * 4. Verificar datos escritos
     * 5. Rename atómico
     * 6. Liberar lock
     */
    private async atomicWrite(): Promise<void> {
        let lastError: Error | null = null

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                await this.acquireLock()
                try {
                    const serialized = JSON.stringify(this.listHistory)

                    // Escribir a temp con fsync para asegurar persistencia
                    const fh = await fsPromises.open(this.tempPath, 'w')
                    try {
                        await fh.writeFile(serialized, 'utf-8')
                        await fh.sync()
                    } finally {
                        await fh.close()
                    }

                    // Verificar integridad del archivo temporal
                    const verification = await fsPromises.readFile(this.tempPath, 'utf-8')
                    const parsed = JSON.parse(verification)
                    if (!Array.isArray(parsed) || parsed.length !== this.listHistory.length) {
                        throw new Error(
                            `Verification failed: expected ${this.listHistory.length} entries, got ${Array.isArray(parsed) ? parsed.length : 'non-array'}`
                        )
                    }

                    // Rename atómico
                    await fsPromises.rename(this.tempPath, this.pathFile)
                    return
                } finally {
                    await this.releaseLock()
                }
            } catch (e) {
                lastError = e as Error
                console.warn(
                    `[JsonFileDB] Write attempt ${attempt + 1}/${MAX_RETRIES} failed:`,
                    (e as Error).message
                )

                // Limpiar temp en caso de error
                try {
                    if (existsSync(this.tempPath)) {
                        await fsPromises.unlink(this.tempPath)
                    }
                } catch {
                    // Ignorar error de limpieza
                }

                if (attempt < MAX_RETRIES - 1) {
                    await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)))
                }
            }
        }

        throw new Error(`[JsonFileDB] Failed to write after ${MAX_RETRIES} attempts: ${lastError?.message}`)
    }

    /**
     * Escribir al archivo de forma segura con cola y debounce opcional
     */
    private async safeWrite(): Promise<void> {
        const debounceTime = this.options.debounceTime || 0

        if (debounceTime > 0) {
            return new Promise<void>((resolve, reject) => {
                this.pendingWriteResolvers.push({ resolve, reject })

                if (this.debounceTimer) {
                    clearTimeout(this.debounceTimer)
                }

                this.debounceTimer = setTimeout(async () => {
                    this.debounceTimer = null
                    const resolvers = [...this.pendingWriteResolvers]
                    this.pendingWriteResolvers = []

                    this.writeQueue = this.writeQueue.then(async () => {
                        try {
                            await this.atomicWrite()
                            resolvers.forEach((r) => r.resolve())
                        } catch (e) {
                            console.error('[JsonFileDB] Error writing to database:', (e as Error).message)
                            resolvers.forEach((r) => r.reject(e as Error))
                        }
                    })

                    await this.writeQueue
                }, debounceTime)
            })
        } else {
            return new Promise<void>((resolve, reject) => {
                this.writeQueue = this.writeQueue.then(async () => {
                    try {
                        await this.atomicWrite()
                        resolve()
                    } catch (e) {
                        console.error('[JsonFileDB] Error writing to database:', (e as Error).message)
                        reject(e)
                    }
                })
            })
        }
    }

    /**
     * Buscar el último mensaje por número
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
     */
    async save(ctx: HistoryEntry): Promise<void> {
        await this.waitForInit()
        this.listHistory.push(ctx)
        await this.safeWrite()
    }
}

export { JsonFileDB }
