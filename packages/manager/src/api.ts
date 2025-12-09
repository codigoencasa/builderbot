import type { IncomingMessage, ServerResponse } from 'http'
import polka from 'polka'

import type { BotManager } from './bot-manager'
import { FlowRegistry, type FlowDefinition } from './flow-registry'
import { RateLimiter, type RateLimiterConfig } from './rate-limiter'
import {
    createBotSchema,
    updateBotSchema,
    restartBotSchema,
    createFlowSchema,
    updateFlowSchema,
    validate,
    type UpdateBotInput,
    type RestartBotInput,
    type CreateFlowInput,
    type UpdateFlowInput,
} from './schemas'
import { openApiSpec, generateSwaggerHtml } from './swagger'
import type { Flow } from './types'

interface ApiConfig {
    port: number
    apiKey?: string
    /** Rate limiter configuration */
    rateLimit?: RateLimiterConfig | false
}

// Extend request with body
interface Request extends IncomingMessage {
    body?: any
    params?: Record<string, string>
}

/**
 * REST API for managing bots via HTTP endpoints using Polka
 */
export class BotManagerApi {
    private manager: BotManager
    private config: ApiConfig
    private app: ReturnType<typeof polka> | null = null
    private flowRegistry: FlowRegistry
    private qrCodes: Map<string, string> = new Map()
    private rateLimiter: RateLimiter | null = null

    constructor(manager: BotManager, config: ApiConfig) {
        this.manager = manager
        this.config = config
        this.flowRegistry = new FlowRegistry()
        this.setupQrListener()

        // Initialize rate limiter unless disabled
        if (config.rateLimit !== false) {
            this.rateLimiter = new RateLimiter(config.rateLimit)
        }
    }

    /**
     * Get the flow registry for external access
     */
    getFlowRegistry(): FlowRegistry {
        return this.flowRegistry
    }

    /**
     * Register a flow that can be used when creating bots via API
     */
    registerFlow(id: string, name: string, flow: Flow): FlowDefinition {
        return this.flowRegistry.register(id, name, flow)
    }

    /**
     * Get all registered flows
     */
    getRegisteredFlows(): FlowDefinition[] {
        return this.flowRegistry.getAll()
    }

    /**
     * Get a single flow by ID
     */
    getFlow(id: string): FlowDefinition | undefined {
        return this.flowRegistry.get(id)
    }

    /**
     * Listen for QR codes to store them
     */
    private setupQrListener(): void {
        this.manager.on('bot:qr', (tenantId, data) => {
            if (data?.qr) {
                this.qrCodes.set(tenantId, data.qr)
            }
        })

        this.manager.on('bot:connected', (tenantId) => {
            this.qrCodes.delete(tenantId)
        })
    }

    /**
     * JSON body parser middleware
     */
    private jsonParser() {
        return async (req: Request, res: ServerResponse, next: () => void) => {
            if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
                try {
                    const chunks: Buffer[] = []
                    for await (const chunk of req) {
                        chunks.push(chunk as Buffer)
                    }
                    const body = Buffer.concat(chunks).toString()
                    req.body = body ? JSON.parse(body) : {}
                } catch {
                    req.body = {}
                }
            }
            next()
        }
    }

    /**
     * CORS middleware
     */
    private cors() {
        return (req: Request, res: ServerResponse, next: () => void) => {
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization')

            if (req.method === 'OPTIONS') {
                res.writeHead(204)
                res.end()
                return
            }
            next()
        }
    }

    /**
     * Auth middleware
     */
    private auth() {
        return (req: Request, res: ServerResponse, next: () => void) => {
            if (!this.config.apiKey) return next()

            // Skip auth for docs and health
            const url = req.url || ''
            if (url === '/docs' || url.startsWith('/api/docs')) {
                return next()
            }

            const authHeader = req.headers['x-api-key'] || req.headers['authorization']
            if (authHeader === this.config.apiKey || authHeader === `Bearer ${this.config.apiKey}`) {
                return next()
            }

            this.sendJson(res, 401, { error: 'Unauthorized' })
        }
    }

    /**
     * Send JSON response
     */
    private sendJson(res: ServerResponse, status: number, data: any): void {
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(data))
    }

    /**
     * Start the API server
     */
    start(): void {
        this.app = polka().use(this.cors())

        // Add rate limiter if enabled
        if (this.rateLimiter) {
            this.app.use(this.rateLimiter.middleware())
        }

        this.app.use(this.jsonParser()).use(this.auth())

        // Swagger UI - no auth required
        this.app.get('/docs', (req: Request, res: ServerResponse) => {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(generateSwaggerHtml('/api/docs/openapi.json'))
        })

        // OpenAPI spec
        this.app.get('/api/docs/openapi.json', (req: Request, res: ServerResponse) => {
            this.sendJson(res, 200, openApiSpec)
        })

        // Health check - enhanced
        this.app.get('/api/health', (req: Request, res: ServerResponse) => {
            const health = this.manager.getHealthInfo()
            this.sendJson(res, 200, {
                ...health,
                timestamp: new Date().toISOString(),
                flows: this.flowRegistry.count(),
                rateLimiter: this.rateLimiter?.getStats() || null,
            })
        })

        // ============ FLOWS ============

        // Get all flows
        this.app.get('/api/flows', (req: Request, res: ServerResponse) => {
            const flows = this.flowRegistry.getAll().map((f) => ({
                id: f.id,
                name: f.name,
                dynamic: f.dynamic,
                config: f.dynamic ? f.config : undefined,
                createdAt: f.createdAt,
                updatedAt: f.updatedAt,
            }))
            this.sendJson(res, 200, {
                count: flows.length,
                flows,
            })
        })

        // Create a new dynamic flow
        this.app.post('/api/flows', async (req: Request, res: ServerResponse) => {
            await this.handleCreateFlow(req, res)
        })

        // Get single flow
        this.app.get('/api/flows/:flowId', (req: Request, res: ServerResponse) => {
            const flowId = req.params?.flowId || ''
            const flow = this.flowRegistry.get(flowId)

            if (!flow) {
                return this.sendJson(res, 404, { error: 'Flow not found' })
            }

            this.sendJson(res, 200, {
                id: flow.id,
                name: flow.name,
                dynamic: flow.dynamic,
                config: flow.dynamic ? flow.config : undefined,
                createdAt: flow.createdAt,
                updatedAt: flow.updatedAt,
            })
        })

        // Update a dynamic flow
        this.app.put('/api/flows/:flowId', async (req: Request, res: ServerResponse) => {
            await this.handleUpdateFlow(req, res)
        })

        // Delete a flow
        this.app.delete('/api/flows/:flowId', (req: Request, res: ServerResponse) => {
            const flowId = req.params?.flowId || ''
            const flow = this.flowRegistry.get(flowId)

            if (!flow) {
                return this.sendJson(res, 404, { error: 'Flow not found' })
            }

            if (!flow.dynamic) {
                return this.sendJson(res, 400, {
                    error: 'Cannot delete programmatic flows. Only dynamic flows can be deleted.',
                })
            }

            this.flowRegistry.remove(flowId)
            this.sendJson(res, 200, { message: 'Flow deleted successfully', flowId })
        })

        // ============ BOTS ============

        // List all bots
        this.app.get('/api/bots', (req: Request, res: ServerResponse) => {
            this.sendJson(res, 200, {
                count: this.manager.getBotCount(),
                bots: this.manager.getBotsInfo(),
            })
        })

        // Create bot
        this.app.post('/api/bots', async (req: Request, res: ServerResponse) => {
            await this.handleCreateBot(req, res)
        })

        // Get single bot
        this.app.get('/api/bots/:tenantId', (req: Request, res: ServerResponse) => {
            const tenantId = req.params?.tenantId || ''
            const bot = this.manager.getBot(tenantId)

            if (!bot) {
                return this.sendJson(res, 404, { error: 'Bot not found' })
            }

            this.sendJson(res, 200, {
                tenantId: bot.tenantId,
                name: bot.name,
                status: bot.status,
                port: bot.port,
                createdAt: bot.createdAt,
                uptime: Date.now() - bot.createdAt.getTime(),
                providerType: bot.providerType,
                databaseType: bot.databaseType,
                reconnectState: this.manager.getReconnectState(tenantId),
            })
        })

        // Update bot
        this.app.put('/api/bots/:tenantId', async (req: Request, res: ServerResponse) => {
            await this.handleUpdateBot(req, res)
        })

        // Delete bot
        this.app.delete('/api/bots/:tenantId', async (req: Request, res: ServerResponse) => {
            const tenantId = req.params?.tenantId || ''
            const removed = await this.manager.removeBot(tenantId)

            if (!removed) {
                return this.sendJson(res, 404, { error: 'Bot not found' })
            }

            this.qrCodes.delete(tenantId)
            this.sendJson(res, 200, { message: 'Bot removed successfully', tenantId })
        })

        // Get QR code
        this.app.get('/api/bots/:tenantId/qr', (req: Request, res: ServerResponse) => {
            const tenantId = req.params?.tenantId || ''
            const bot = this.manager.getBot(tenantId)

            if (!bot) {
                return this.sendJson(res, 404, { error: 'Bot not found' })
            }

            if (bot.status === 'connected') {
                return this.sendJson(res, 200, { status: 'connected', qr: null })
            }

            const qr = this.qrCodes.get(tenantId)
            this.sendJson(res, 200, {
                status: bot.status,
                qr: qr || null,
                message: qr ? 'Scan QR to connect' : 'QR not available yet',
            })
        })

        // Restart bot
        this.app.post('/api/bots/:tenantId/restart', async (req: Request, res: ServerResponse) => {
            await this.handleRestartBot(req, res)
        })

        // Reconnect bot (manual reconnection)
        this.app.post('/api/bots/:tenantId/reconnect', async (req: Request, res: ServerResponse) => {
            const tenantId = req.params?.tenantId || ''
            const success = await this.manager.reconnectBot(tenantId)

            this.sendJson(res, success ? 200 : 404, {
                success,
                message: success ? 'Bot reconnection initiated' : 'Bot not found or no stored config',
            })
        })

        // Stop bot
        this.app.post('/api/bots/:tenantId/stop', async (req: Request, res: ServerResponse) => {
            const tenantId = req.params?.tenantId || ''
            const removed = await this.manager.removeBot(tenantId)

            this.sendJson(res, removed ? 200 : 404, {
                success: removed,
                message: removed ? 'Bot stopped' : 'Bot not found',
            })
        })

        // Start server
        this.app.listen(this.config.port, () => {
            console.log(`🚀 BotManager API running on port ${this.config.port}`)
            console.log(`📚 Swagger UI: http://localhost:${this.config.port}/docs`)
            if (this.rateLimiter) {
                console.log(`🛡️  Rate limiting enabled`)
            }
        })
    }

    /**
     * Stop the API server
     */
    stop(): void {
        if (this.app?.server) {
            this.app.server.close()
            this.app = null
        }
        if (this.rateLimiter) {
            this.rateLimiter.destroy()
        }
    }

    // ============ Handlers ============

    private async handleCreateBot(req: Request, res: ServerResponse): Promise<void> {
        const validation = validate(createBotSchema, req.body)
        if (!validation.success || !validation.data) {
            return this.sendJson(res, 400, {
                error: 'Validation failed',
                details: validation.errors,
            })
        }

        const { tenantId, name, flowIds, port, providerOptions } = validation.data

        // Resolve flows from registry
        const { flows, missing } = this.flowRegistry.resolveFlows(flowIds)

        if (missing.length > 0) {
            return this.sendJson(res, 400, {
                error: `Flows not found: ${missing.join(', ')}`,
                availableFlows: this.flowRegistry.getIds(),
            })
        }

        if (this.manager.hasBot(tenantId)) {
            return this.sendJson(res, 409, { error: 'Bot with this tenantId already exists' })
        }

        try {
            const bot = await this.manager.createBot({
                tenantId,
                name,
                flows,
                port,
                providerOptions,
            })

            this.sendJson(res, 201, {
                message: 'Bot created successfully',
                tenantId: bot.tenantId,
                name: bot.name,
                status: bot.status,
                port: bot.port,
                flowsUsed: flowIds,
                providerType: bot.providerType,
                databaseType: bot.databaseType,
            })
        } catch (error: any) {
            this.sendJson(res, 500, { error: error.message || 'Failed to create bot' })
        }
    }

    private async handleUpdateBot(req: Request, res: ServerResponse): Promise<void> {
        const tenantId = req.params?.tenantId || ''

        const validation = validate<UpdateBotInput>(updateBotSchema, req.body)
        if (!validation.success) {
            return this.sendJson(res, 400, {
                error: 'Validation failed',
                details: validation.errors,
            })
        }

        const bot = this.manager.getBot(tenantId)
        if (!bot) {
            return this.sendJson(res, 404, { error: 'Bot not found' })
        }

        if (validation.data?.name) {
            bot.name = validation.data.name
        }

        this.sendJson(res, 200, {
            message: 'Bot updated',
            tenantId: bot.tenantId,
            name: bot.name,
        })
    }

    private async handleRestartBot(req: Request, res: ServerResponse): Promise<void> {
        const tenantId = req.params?.tenantId || ''

        const validation = validate<RestartBotInput>(restartBotSchema, req.body)
        if (!validation.success || !validation.data) {
            return this.sendJson(res, 400, {
                error: 'Validation failed',
                details: validation.errors,
            })
        }

        const { flowIds, port, name } = validation.data
        const { flows, missing } = this.flowRegistry.resolveFlows(flowIds)

        if (flows.length === 0) {
            return this.sendJson(res, 400, {
                error:
                    missing.length > 0 ? `Flows not found: ${missing.join(', ')}` : 'No valid flows found in registry',
            })
        }

        try {
            const newBot = await this.manager.restartBot(tenantId, { flows, port, name })
            if (!newBot) {
                return this.sendJson(res, 404, { error: 'Bot not found' })
            }
            this.sendJson(res, 200, {
                message: 'Bot restarted',
                tenantId,
                status: newBot.status,
            })
        } catch (error: any) {
            this.sendJson(res, 500, { error: error.message || 'Failed to restart bot' })
        }
    }

    // ============ Flow Handlers ============

    private async handleCreateFlow(req: Request, res: ServerResponse): Promise<void> {
        const validation = validate<CreateFlowInput>(createFlowSchema, req.body)
        if (!validation.success || !validation.data) {
            return this.sendJson(res, 400, {
                error: 'Validation failed',
                details: validation.errors,
            })
        }

        const { id } = validation.data

        if (this.flowRegistry.has(id)) {
            return this.sendJson(res, 409, { error: `Flow with id "${id}" already exists` })
        }

        try {
            const flowDef = this.flowRegistry.registerDynamic(validation.data)

            this.sendJson(res, 201, {
                message: 'Flow created successfully',
                id: flowDef.id,
                name: flowDef.name,
                dynamic: true,
                config: flowDef.config,
                createdAt: flowDef.createdAt,
            })
        } catch (error: any) {
            this.sendJson(res, 500, { error: error.message || 'Failed to create flow' })
        }
    }

    private async handleUpdateFlow(req: Request, res: ServerResponse): Promise<void> {
        const flowId = req.params?.flowId || ''

        const existing = this.flowRegistry.get(flowId)
        if (!existing) {
            return this.sendJson(res, 404, { error: 'Flow not found' })
        }

        if (!existing.dynamic) {
            return this.sendJson(res, 400, {
                error: 'Cannot update programmatic flows. Only dynamic flows can be updated.',
            })
        }

        const validation = validate<UpdateFlowInput>(updateFlowSchema, req.body)
        if (!validation.success) {
            return this.sendJson(res, 400, {
                error: 'Validation failed',
                details: validation.errors,
            })
        }

        try {
            const flowDef = this.flowRegistry.update(flowId, validation.data || {})

            if (!flowDef) {
                return this.sendJson(res, 500, { error: 'Failed to update flow' })
            }

            this.sendJson(res, 200, {
                message: 'Flow updated successfully',
                id: flowDef.id,
                name: flowDef.name,
                dynamic: true,
                config: flowDef.config,
                updatedAt: flowDef.updatedAt,
            })
        } catch (error: any) {
            this.sendJson(res, 500, { error: error.message || 'Failed to update flow' })
        }
    }
}
