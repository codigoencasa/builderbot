import type { MemoryDB } from '@builderbot/bot'

/** Flow type - using ReturnType to infer from addKeyword */
export type Flow = ReturnType<typeof import('@builderbot/bot').addKeyword>

/**
 * Provider class type - any class that can be used with createProvider
 */
export type ProviderClass = new (...args: any[]) => any

/**
 * Database class type - any class that implements the database interface
 */
export type DatabaseClass = new (...args: any[]) => any

/**
 * Provider factory function type
 */
export type ProviderFactory = (options: Record<string, any>) => any

/**
 * Database factory function type
 */
export type DatabaseFactory = (options: Record<string, any>) => any

/**
 * Configuration for creating a new tenant bot
 */
export interface TenantConfig {
    /** Unique identifier for the tenant */
    tenantId: string
    /** Display name for the tenant */
    name?: string
    /** Array of flows for this tenant's bot */
    flows: Flow[]
    /** Port for the HTTP server (optional, each tenant can have its own) */
    port?: number
    /** Custom provider options */
    providerOptions?: Record<string, any>
    /** Custom database options */
    databaseOptions?: Record<string, any>
    /** Override provider class for this specific tenant */
    providerClass?: ProviderClass
    /** Override database class for this specific tenant */
    databaseClass?: DatabaseClass
}

/**
 * Represents a running bot instance for a tenant
 */
export interface BotInstance {
    /** Tenant identifier */
    tenantId: string
    /** Display name */
    name: string
    /** The provider instance */
    provider: any
    /** The database instance */
    database: any
    /** Context handler for HTTP requests */
    handleCtx: (callback: (bot: any, req: any, res: any) => Promise<any>) => any
    /** HTTP server function */
    httpServer: (port: number) => void
    /** Bot instance with sendMessage, dispatch, blacklist methods */
    bot: any
    /** Port the HTTP server is running on */
    port?: number
    /** Timestamp when the bot was created */
    createdAt: Date
    /** Status of the bot */
    status: BotStatus
    /** Provider class used */
    providerType?: string
    /** Database class used */
    databaseType?: string
}

/**
 * Status of a bot instance
 */
export type BotStatus = 'initializing' | 'connected' | 'disconnected' | 'error'

/**
 * Global configuration for the BotManager
 */
export interface BotManagerConfig {
    /** Base directory for session storage */
    sessionsDir?: string
    /** Default provider options applied to all bots */
    defaultProviderOptions?: Record<string, any>
    /** Default database options applied to all bots */
    defaultDatabaseOptions?: Record<string, any>
    /** Default provider class to use (defaults to BaileysProvider if not specified) */
    defaultProviderClass?: ProviderClass
    /** Default database class to use (defaults to MemoryDB if not specified) */
    defaultDatabaseClass?: DatabaseClass
    /** Auto-reconnect configuration */
    autoReconnect?: {
        /** Enable auto-reconnect (default: true) */
        enabled?: boolean
        /** Maximum retry attempts (default: 5) */
        maxRetries?: number
        /** Initial delay in ms (default: 1000) */
        initialDelay?: number
        /** Max delay in ms (default: 30000) */
        maxDelay?: number
    }
}

/**
 * Events emitted by the BotManager
 */
export type BotManagerEvent =
    | 'bot:created'
    | 'bot:removed'
    | 'bot:connected'
    | 'bot:disconnected'
    | 'bot:error'
    | 'bot:qr'
    | 'bot:reconnecting'

/**
 * Event handler callback type
 */
export type BotManagerEventHandler = (tenantId: string, data?: any) => void

/**
 * Reconnection state for a bot
 */
export interface ReconnectState {
    attempts: number
    lastAttempt: Date
    nextDelay: number
    isReconnecting: boolean
}
