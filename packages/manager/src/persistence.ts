import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'

import type { TenantConfig, Flow } from './types'

/**
 * Serializable bot configuration (without Flow objects)
 */
export interface SerializableBotConfig {
    tenantId: string
    name?: string
    flowIds: string[]
    port?: number
    providerOptions?: Record<string, any>
    databaseOptions?: Record<string, any>
    providerClassName?: string
    databaseClassName?: string
    createdAt: string
}

/**
 * Persistence configuration
 */
export interface PersistenceConfig {
    /** Directory to store persistence files */
    persistenceDir?: string
    /** File name for the persistence file */
    fileName?: string
    /** Whether to auto-save on changes */
    autoSave?: boolean
}

/**
 * Persistence manager for saving/loading bot configurations
 */
export class PersistenceManager {
    private config: Required<PersistenceConfig>
    private filePath: string
    private data: Map<string, SerializableBotConfig> = new Map()

    constructor(config: PersistenceConfig = {}) {
        this.config = {
            persistenceDir: config.persistenceDir ?? './data',
            fileName: config.fileName ?? 'bots.json',
            autoSave: config.autoSave ?? true,
        }
        this.filePath = join(this.config.persistenceDir, this.config.fileName)
        this.load()
    }

    /**
     * Save a bot configuration
     */
    save(
        tenantId: string,
        config: Omit<TenantConfig, 'flows'> & { flowIds: string[] },
        providerClassName?: string,
        databaseClassName?: string
    ): void {
        const serializableConfig: SerializableBotConfig = {
            tenantId: config.tenantId,
            name: config.name,
            flowIds: config.flowIds,
            port: config.port,
            providerOptions: config.providerOptions,
            databaseOptions: config.databaseOptions,
            providerClassName,
            databaseClassName,
            createdAt: new Date().toISOString(),
        }

        this.data.set(tenantId, serializableConfig)

        if (this.config.autoSave) {
            this.persist()
        }
    }

    /**
     * Remove a bot configuration
     */
    remove(tenantId: string): boolean {
        const result = this.data.delete(tenantId)

        if (result && this.config.autoSave) {
            this.persist()
        }

        return result
    }

    /**
     * Get a bot configuration
     */
    get(tenantId: string): SerializableBotConfig | undefined {
        return this.data.get(tenantId)
    }

    /**
     * Get all bot configurations
     */
    getAll(): SerializableBotConfig[] {
        return Array.from(this.data.values())
    }

    /**
     * Check if a bot configuration exists
     */
    has(tenantId: string): boolean {
        return this.data.has(tenantId)
    }

    /**
     * Clear all configurations
     */
    clear(): void {
        this.data.clear()

        if (this.config.autoSave) {
            this.persist()
        }
    }

    /**
     * Get count of stored configurations
     */
    count(): number {
        return this.data.size
    }

    /**
     * Persist data to file
     */
    persist(): void {
        try {
            const dir = dirname(this.filePath)
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true })
            }

            const dataToSave = {
                version: 1,
                updatedAt: new Date().toISOString(),
                bots: Array.from(this.data.entries()),
            }

            writeFileSync(this.filePath, JSON.stringify(dataToSave, null, 2), 'utf-8')
        } catch (error) {
            console.error('Failed to persist bot configurations:', error)
        }
    }

    /**
     * Load data from file
     */
    load(): void {
        try {
            if (!existsSync(this.filePath)) {
                return
            }

            const content = readFileSync(this.filePath, 'utf-8')
            const parsed = JSON.parse(content)

            if (parsed.bots && Array.isArray(parsed.bots)) {
                this.data = new Map(parsed.bots)
            }
        } catch (error) {
            console.error('Failed to load bot configurations:', error)
            this.data = new Map()
        }
    }

    /**
     * Delete the persistence file
     */
    deleteFile(): void {
        try {
            if (existsSync(this.filePath)) {
                unlinkSync(this.filePath)
            }
            this.data.clear()
        } catch (error) {
            console.error('Failed to delete persistence file:', error)
        }
    }

    /**
     * Get the file path
     */
    getFilePath(): string {
        return this.filePath
    }
}

/**
 * Default persistence manager instance
 */
let defaultPersistence: PersistenceManager | null = null

/**
 * Get or create the default persistence manager
 */
export function getDefaultPersistence(config?: PersistenceConfig): PersistenceManager {
    if (!defaultPersistence) {
        defaultPersistence = new PersistenceManager(config)
    }
    return defaultPersistence
}

/**
 * Reset the default persistence manager (useful for testing)
 */
export function resetDefaultPersistence(): void {
    defaultPersistence = null
}
