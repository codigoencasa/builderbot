import { createBot, createProvider, createFlow, MemoryDB } from '@builderbot/bot'
import { join } from 'path'

import type {
    TenantConfig,
    BotInstance,
    BotManagerConfig,
    BotStatus,
    BotManagerEvent,
    BotManagerEventHandler,
    ProviderClass,
    DatabaseClass,
    ReconnectState,
} from './types'

/**
 * Multi-tenant Bot Manager
 * Manages multiple WhatsApp bot instances, each with its own session and flows
 */
export class BotManager {
    private bots: Map<string, BotInstance> = new Map()
    private config: BotManagerConfig
    private eventHandlers: Map<BotManagerEvent, Set<BotManagerEventHandler>> = new Map()
    private reconnectStates: Map<string, ReconnectState> = new Map()
    private tenantConfigs: Map<string, TenantConfig> = new Map()

    constructor(config: BotManagerConfig = {}) {
        this.config = {
            sessionsDir: config.sessionsDir ?? './sessions',
            defaultProviderOptions: config.defaultProviderOptions ?? {},
            defaultDatabaseOptions: config.defaultDatabaseOptions ?? {},
            defaultProviderClass: config.defaultProviderClass,
            defaultDatabaseClass: config.defaultDatabaseClass ?? MemoryDB,
            autoReconnect: {
                enabled: config.autoReconnect?.enabled ?? true,
                maxRetries: config.autoReconnect?.maxRetries ?? 5,
                initialDelay: config.autoReconnect?.initialDelay ?? 1000,
                maxDelay: config.autoReconnect?.maxDelay ?? 30000,
            },
        }
    }

    /**
     * Create a new bot instance for a tenant
     */
    async createBot(tenantConfig: TenantConfig): Promise<BotInstance> {
        const {
            tenantId,
            name,
            flows,
            port,
            providerOptions = {},
            databaseOptions = {},
            providerClass,
            databaseClass,
        } = tenantConfig

        if (this.bots.has(tenantId)) {
            throw new Error(`Bot with tenantId "${tenantId}" already exists`)
        }

        // Store config for potential reconnection
        this.tenantConfigs.set(tenantId, tenantConfig)

        // Each tenant gets isolated session storage
        const sessionPath = join(this.config.sessionsDir!, tenantId)

        const adapterFlow = createFlow(flows)

        // Use tenant-specific or default provider class
        const ProviderToUse = providerClass || this.config.defaultProviderClass
        if (!ProviderToUse) {
            throw new Error(
                'No provider class specified. Set defaultProviderClass in BotManagerConfig or providerClass in TenantConfig'
            )
        }

        // Pass session path to provider for isolated sessions per tenant
        const adapterProvider = createProvider(ProviderToUse, {
            ...this.config.defaultProviderOptions,
            ...providerOptions,
            name: sessionPath, // This creates isolated session folder per tenant
        })

        // Use tenant-specific or default database class
        const DatabaseToUse = databaseClass || this.config.defaultDatabaseClass || MemoryDB
        const adapterDB = new DatabaseToUse({
            ...this.config.defaultDatabaseOptions,
            ...databaseOptions,
        })

        const { handleCtx, httpServer } = await createBot({
            flow: adapterFlow,
            provider: adapterProvider,
            database: adapterDB,
        })

        const botInstance: BotInstance = {
            tenantId,
            name: name ?? tenantId,
            provider: adapterProvider,
            database: adapterDB,
            handleCtx,
            httpServer,
            bot: null as any,
            port,
            createdAt: new Date(),
            status: 'initializing' as BotStatus,
            providerType: ProviderToUse.name,
            databaseType: DatabaseToUse.name,
        }

        this.bots.set(tenantId, botInstance)

        // Initialize reconnect state
        this.reconnectStates.set(tenantId, {
            attempts: 0,
            lastAttempt: new Date(),
            nextDelay: this.config.autoReconnect!.initialDelay!,
            isReconnecting: false,
        })

        // Setup provider event listeners for real status tracking
        this.setupProviderEvents(tenantId, adapterProvider)

        // Start HTTP server if port is provided
        if (port) {
            httpServer(port)
        }

        this.emit('bot:created', tenantId, {
            name: botInstance.name,
            port,
            sessionPath,
            providerType: botInstance.providerType,
            databaseType: botInstance.databaseType,
        })

        return botInstance
    }

    /**
     * Setup event listeners on the provider for real-time status updates
     */
    private setupProviderEvents(tenantId: string, provider: any): void {
        const bot = this.bots.get(tenantId)
        if (!bot) return

        // Listen for connection events
        provider.on('connection.update', (update: any) => {
            const { connection, qr } = update

            if (qr) {
                this.emit('bot:qr', tenantId, { qr })
            }

            if (connection === 'open') {
                bot.status = 'connected'
                // Reset reconnect state on successful connection
                const reconnectState = this.reconnectStates.get(tenantId)
                if (reconnectState) {
                    reconnectState.attempts = 0
                    reconnectState.nextDelay = this.config.autoReconnect!.initialDelay!
                    reconnectState.isReconnecting = false
                }
                this.emit('bot:connected', tenantId)
            } else if (connection === 'close') {
                bot.status = 'disconnected'
                this.emit('bot:disconnected', tenantId)

                // Attempt auto-reconnection
                if (this.config.autoReconnect?.enabled) {
                    this.attemptReconnect(tenantId)
                }
            }
        })

        // Listen for errors
        provider.on('error', (error: any) => {
            bot.status = 'error'
            this.emit('bot:error', tenantId, { error })
        })
    }

    /**
     * Attempt to reconnect a disconnected bot with exponential backoff
     */
    private async attemptReconnect(tenantId: string): Promise<void> {
        const reconnectState = this.reconnectStates.get(tenantId)
        const config = this.tenantConfigs.get(tenantId)

        if (!reconnectState || !config) return
        if (reconnectState.isReconnecting) return

        const { maxRetries, maxDelay } = this.config.autoReconnect!

        if (reconnectState.attempts >= maxRetries!) {
            this.emit('bot:error', tenantId, {
                error: new Error(`Max reconnection attempts (${maxRetries}) reached`),
            })
            return
        }

        reconnectState.isReconnecting = true
        reconnectState.attempts++
        reconnectState.lastAttempt = new Date()

        this.emit('bot:reconnecting', tenantId, {
            attempt: reconnectState.attempts,
            maxRetries,
            nextDelay: reconnectState.nextDelay,
        })

        // Wait before reconnecting
        await this.delay(reconnectState.nextDelay)

        try {
            // Remove the old bot
            await this.removeBot(tenantId)

            // Recreate the bot
            await this.createBot(config)

            // Reset state on success
            reconnectState.isReconnecting = false
        } catch (error) {
            reconnectState.isReconnecting = false

            // Exponential backoff
            reconnectState.nextDelay = Math.min(reconnectState.nextDelay * 2, maxDelay!)

            this.emit('bot:error', tenantId, {
                error,
                reconnectAttempt: reconnectState.attempts,
            })

            // Try again
            this.attemptReconnect(tenantId)
        }
    }

    /**
     * Helper delay function
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    /**
     * Get a bot instance by tenant ID
     */
    getBot(tenantId: string): BotInstance | undefined {
        return this.bots.get(tenantId)
    }

    /**
     * Remove a bot instance and clean up resources
     */
    async removeBot(tenantId: string): Promise<boolean> {
        const bot = this.bots.get(tenantId)

        if (!bot) {
            return false
        }

        try {
            // Attempt to disconnect the provider
            if (bot.provider && typeof (bot.provider as any).disconnect === 'function') {
                await (bot.provider as any).disconnect()
            }
        } catch (error) {
            console.error(`Error disconnecting bot ${tenantId}:`, error)
        }

        this.bots.delete(tenantId)
        this.reconnectStates.delete(tenantId)
        // Note: we keep tenantConfigs for potential manual restart

        this.emit('bot:removed', tenantId)

        return true
    }

    /**
     * List all active tenant IDs
     */
    listBots(): string[] {
        return Array.from(this.bots.keys())
    }

    /**
     * Get all bot instances
     */
    getAllBots(): BotInstance[] {
        return Array.from(this.bots.values())
    }

    /**
     * Check if a tenant has an active bot
     */
    hasBot(tenantId: string): boolean {
        return this.bots.has(tenantId)
    }

    /**
     * Get the count of active bots
     */
    getBotCount(): number {
        return this.bots.size
    }

    /**
     * Shutdown all bots
     */
    async shutdown(): Promise<void> {
        const tenantIds = this.listBots()

        await Promise.all(tenantIds.map((tenantId) => this.removeBot(tenantId)))
    }

    /**
     * Register an event handler
     */
    on(event: BotManagerEvent, handler: BotManagerEventHandler): void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set())
        }
        this.eventHandlers.get(event)!.add(handler)
    }

    /**
     * Remove an event handler
     */
    off(event: BotManagerEvent, handler: BotManagerEventHandler): void {
        const handlers = this.eventHandlers.get(event)
        if (handlers) {
            handlers.delete(handler)
        }
    }

    /**
     * Emit an event
     */
    private emit(event: BotManagerEvent, tenantId: string, data?: any): void {
        const handlers = this.eventHandlers.get(event)
        if (handlers) {
            handlers.forEach((handler) => {
                try {
                    handler(tenantId, data)
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error)
                }
            })
        }
    }

    /**
     * Get bot status
     */
    getBotStatus(tenantId: string): BotStatus | undefined {
        return this.bots.get(tenantId)?.status
    }

    /**
     * Update bot status
     */
    updateBotStatus(tenantId: string, status: BotStatus): void {
        const bot = this.bots.get(tenantId)
        if (bot) {
            bot.status = status
            this.emit(`bot:${status}` as BotManagerEvent, tenantId)
        }
    }

    /**
     * Get reconnection state for a bot
     */
    getReconnectState(tenantId: string): ReconnectState | undefined {
        return this.reconnectStates.get(tenantId)
    }

    /**
     * Manually trigger reconnection for a bot
     */
    async reconnectBot(tenantId: string): Promise<boolean> {
        const config = this.tenantConfigs.get(tenantId)
        if (!config) return false

        // Reset reconnect state
        this.reconnectStates.set(tenantId, {
            attempts: 0,
            lastAttempt: new Date(),
            nextDelay: this.config.autoReconnect!.initialDelay!,
            isReconnecting: false,
        })

        try {
            await this.removeBot(tenantId)
            await this.createBot(config)
            return true
        } catch {
            return false
        }
    }

    /**
     * Restart a bot by removing and recreating it
     */
    async restartBot(tenantId: string, newConfig?: Partial<TenantConfig>): Promise<BotInstance | null> {
        const existingBot = this.bots.get(tenantId)
        const storedConfig = this.tenantConfigs.get(tenantId)

        if (!existingBot && !storedConfig) {
            return null
        }

        // Store original config
        const originalConfig: TenantConfig = storedConfig || {
            tenantId,
            name: existingBot?.name || tenantId,
            flows: [],
            port: existingBot?.port,
        }

        // Remove existing bot
        await this.removeBot(tenantId)

        // Merge configs and recreate
        const mergedConfig = { ...originalConfig, ...newConfig }

        if (!mergedConfig.flows || mergedConfig.flows.length === 0) {
            throw new Error('Flows are required to restart a bot')
        }

        return this.createBot(mergedConfig)
    }

    /**
     * Get summary info of all bots (useful for dashboards)
     */
    getBotsInfo(): Array<{
        tenantId: string
        name: string
        status: BotStatus
        port?: number
        createdAt: Date
        uptime: number
        providerType?: string
        databaseType?: string
        reconnectState?: ReconnectState
    }> {
        return this.getAllBots().map((bot) => ({
            tenantId: bot.tenantId,
            name: bot.name,
            status: bot.status,
            port: bot.port,
            createdAt: bot.createdAt,
            uptime: Date.now() - bot.createdAt.getTime(),
            providerType: bot.providerType,
            databaseType: bot.databaseType,
            reconnectState: this.reconnectStates.get(bot.tenantId),
        }))
    }

    /**
     * Get detailed health information
     */
    getHealthInfo(): {
        status: 'healthy' | 'degraded' | 'unhealthy'
        bots: {
            total: number
            connected: number
            disconnected: number
            error: number
            initializing: number
        }
        memory: NodeJS.MemoryUsage
        uptime: number
    } {
        const bots = this.getAllBots()
        const statusCounts = {
            total: bots.length,
            connected: 0,
            disconnected: 0,
            error: 0,
            initializing: 0,
        }

        for (const bot of bots) {
            statusCounts[bot.status]++
        }

        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
        if (statusCounts.error > 0) {
            status = statusCounts.error === statusCounts.total ? 'unhealthy' : 'degraded'
        } else if (statusCounts.disconnected > statusCounts.connected) {
            status = 'degraded'
        }

        return {
            status,
            bots: statusCounts,
            memory: process.memoryUsage(),
            uptime: process.uptime(),
        }
    }

    /**
     * Send message through a specific bot
     */
    async sendMessage(
        tenantId: string,
        number: string,
        message: string,
        options?: { media?: string }
    ): Promise<boolean> {
        const bot = this.bots.get(tenantId)
        if (!bot || bot.status !== 'connected') {
            return false
        }

        try {
            await bot.provider.sendMessage(number, message, options)
            return true
        } catch (error) {
            console.error(`Error sending message for ${tenantId}:`, error)
            return false
        }
    }
}
