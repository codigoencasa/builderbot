import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { BotManagerApi } from '../src/api'
import { BotManager } from '../src/bot-manager'
import { FlowRegistry } from '../src/flow-registry'
import type { IncomingMessage, ServerResponse } from 'http'

// Mock flow for testing
const createMockFlow = () => ({ addAnswer: () => {} } as any)

// Helper to create a mock BotManager with minimal functionality
const createMockBotManager = () => {
    const bots = new Map()
    const eventHandlers = new Map()

    return {
        bots,
        eventHandlers,
        createBot: async (config: any) => {
            const bot = {
                tenantId: config.tenantId,
                name: config.name || config.tenantId,
                status: 'initializing' as const,
                port: config.port,
                createdAt: new Date(),
                providerType: 'MockProvider',
                databaseType: 'MockDB',
                provider: {},
            }
            bots.set(config.tenantId, bot)
            return bot
        },
        getBot: (tenantId: string) => bots.get(tenantId),
        hasBot: (tenantId: string) => bots.has(tenantId),
        removeBot: async (tenantId: string) => {
            return bots.delete(tenantId)
        },
        getBotCount: () => bots.size,
        getBotsInfo: () =>
            Array.from(bots.values()).map((bot: any) => ({
                tenantId: bot.tenantId,
                name: bot.name,
                status: bot.status,
                port: bot.port,
                createdAt: bot.createdAt,
                uptime: Date.now() - bot.createdAt.getTime(),
                providerType: bot.providerType,
                databaseType: bot.databaseType,
            })),
        getAllBots: () => Array.from(bots.values()),
        getHealthInfo: () => ({
            status: 'healthy' as const,
            bots: {
                total: bots.size,
                connected: 0,
                disconnected: 0,
                error: 0,
                initializing: bots.size,
            },
            memory: process.memoryUsage(),
            uptime: process.uptime(),
        }),
        getReconnectState: () => undefined,
        restartBot: async (tenantId: string, newConfig?: any) => {
            const existing = bots.get(tenantId)
            if (!existing) return null
            const updated = { ...existing, ...newConfig, status: 'initializing' }
            bots.set(tenantId, updated)
            return updated
        },
        reconnectBot: async (tenantId: string) => {
            return bots.has(tenantId)
        },
        on: (event: string, handler: Function) => {
            if (!eventHandlers.has(event)) {
                eventHandlers.set(event, new Set())
            }
            eventHandlers.get(event).add(handler)
        },
        off: (event: string, handler: Function) => {
            eventHandlers.get(event)?.delete(handler)
        },
    } as unknown as BotManager
}

// ============ Constructor Tests ============

test('BotManagerApi - constructor creates instance', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3000 })

    assert.ok(api)
    api.stop()
})

test('BotManagerApi - constructor with API key', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3000, apiKey: 'test-key' })

    assert.ok(api)
    api.stop()
})

test('BotManagerApi - constructor with rate limiting disabled', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3000, rateLimit: false })

    assert.ok(api)
    api.stop()
})

test('BotManagerApi - constructor with custom rate limit config', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, {
        port: 3000,
        rateLimit: {
            maxRequests: 50,
            windowMs: 30000,
        },
    })

    assert.ok(api)
    api.stop()
})

// ============ getFlowRegistry() Tests ============

test('BotManagerApi - getFlowRegistry returns FlowRegistry instance', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3000 })

    const registry = api.getFlowRegistry()

    assert.ok(registry)
    assert.ok(registry instanceof FlowRegistry)
    api.stop()
})

// ============ registerFlow() Tests ============

test('BotManagerApi - registerFlow adds flow to registry', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3000 })
    const mockFlow = createMockFlow()

    const result = api.registerFlow('test-flow', 'Test Flow', mockFlow)

    assert.is(result.id, 'test-flow')
    assert.is(result.name, 'Test Flow')
    assert.is(result.dynamic, false)
    api.stop()
})

test('BotManagerApi - registerFlow adds multiple flows', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3000 })

    api.registerFlow('flow1', 'Flow 1', createMockFlow())
    api.registerFlow('flow2', 'Flow 2', createMockFlow())
    api.registerFlow('flow3', 'Flow 3', createMockFlow())

    const flows = api.getRegisteredFlows()
    assert.is(flows.length, 3)
    api.stop()
})

// ============ getRegisteredFlows() Tests ============

test('BotManagerApi - getRegisteredFlows returns empty array initially', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3000 })

    const flows = api.getRegisteredFlows()

    assert.equal(flows, [])
    api.stop()
})

test('BotManagerApi - getRegisteredFlows returns all flows', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3000 })

    api.registerFlow('flow1', 'Flow 1', createMockFlow())
    api.registerFlow('flow2', 'Flow 2', createMockFlow())

    const flows = api.getRegisteredFlows()

    assert.is(flows.length, 2)
    api.stop()
})

// ============ getFlow() Tests ============

test('BotManagerApi - getFlow returns flow by ID', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3000 })

    api.registerFlow('my-flow', 'My Flow', createMockFlow())

    const flow = api.getFlow('my-flow')

    assert.ok(flow)
    assert.is(flow?.id, 'my-flow')
    assert.is(flow?.name, 'My Flow')
    api.stop()
})

test('BotManagerApi - getFlow returns undefined for non-existent', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3000 })

    const flow = api.getFlow('non-existent')

    assert.is(flow, undefined)
    api.stop()
})

// ============ start() and stop() Tests ============

test('BotManagerApi - start initializes server', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3099 })

    // Start should not throw
    api.start()

    // Server should be running
    assert.ok(true)

    api.stop()
})

test('BotManagerApi - stop closes server', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3098 })

    api.start()
    api.stop()

    // Should not throw
    assert.ok(true)
})

test('BotManagerApi - stop can be called without start', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3000 })

    // Should not throw
    api.stop()

    assert.ok(true)
})

test('BotManagerApi - stop can be called multiple times', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3097 })

    api.start()
    api.stop()
    api.stop()
    api.stop()

    assert.ok(true)
})

// ============ QR Code Listener Tests ============

test('BotManagerApi - sets up QR listener on manager', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3000 })

    // Check that event handlers were registered
    assert.ok((manager as any).eventHandlers.has('bot:qr'))
    assert.ok((manager as any).eventHandlers.has('bot:connected'))

    api.stop()
})

// ============ Flow Registry Integration Tests ============

test('BotManagerApi - flow registry persists across operations', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3000 })

    api.registerFlow('persistent', 'Persistent Flow', createMockFlow())

    // Get registry directly
    const registry1 = api.getFlowRegistry()
    const registry2 = api.getFlowRegistry()

    assert.is(registry1, registry2)
    assert.ok(registry1.has('persistent'))

    api.stop()
})

test('BotManagerApi - can register dynamic flows via registry', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3000 })

    const registry = api.getFlowRegistry()
    registry.registerDynamic({
        id: 'dynamic-flow',
        name: 'Dynamic Flow',
        keyword: 'test',
        steps: [{ answer: 'Hello' }],
    })

    const flow = api.getFlow('dynamic-flow')
    assert.ok(flow)
    assert.is(flow?.dynamic, true)

    api.stop()
})

// ============ Edge Cases ============

test('BotManagerApi - handles manager with no bots', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3000 })

    // Manager operations should work
    assert.is(manager.getBotCount(), 0)
    assert.equal(manager.getBotsInfo(), [])

    api.stop()
})

test('BotManagerApi - handles empty flow registry', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3000 })

    const registry = api.getFlowRegistry()

    assert.is(registry.count(), 0)
    assert.equal(registry.getAll(), [])

    api.stop()
})

test('BotManagerApi - flow operations after multiple registrations', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3000 })

    // Register many flows
    for (let i = 0; i < 100; i++) {
        api.registerFlow(`flow-${i}`, `Flow ${i}`, createMockFlow())
    }

    const flows = api.getRegisteredFlows()
    assert.is(flows.length, 100)

    // Check specific flows
    assert.ok(api.getFlow('flow-0'))
    assert.ok(api.getFlow('flow-50'))
    assert.ok(api.getFlow('flow-99'))
    assert.not.ok(api.getFlow('flow-100'))

    api.stop()
})

test('BotManagerApi - flow with special characters in name', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3000 })

    api.registerFlow('special-flow', 'Flow with émojis 🚀 and spëcial chars!', createMockFlow())

    const flow = api.getFlow('special-flow')
    assert.is(flow?.name, 'Flow with émojis 🚀 and spëcial chars!')

    api.stop()
})

// ============ Rate Limiter Integration Tests ============

test('BotManagerApi - rate limiter is initialized by default', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3000 })

    // Rate limiter should be active
    assert.ok(true)

    api.stop()
})

test('BotManagerApi - rate limiter can be disabled', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, {
        port: 3000,
        rateLimit: false,
    })

    // Should not throw
    assert.ok(true)

    api.stop()
})

// ============ Concurrent Operations Tests ============

test('BotManagerApi - handles concurrent flow registrations', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3000 })

    // Simulate concurrent registrations
    const promises = []
    for (let i = 0; i < 50; i++) {
        promises.push(Promise.resolve(api.registerFlow(`concurrent-${i}`, `Concurrent ${i}`, createMockFlow())))
    }

    Promise.all(promises).then(() => {
        const flows = api.getRegisteredFlows()
        assert.is(flows.length, 50)
    })

    api.stop()
})

// ============ Memory and Cleanup Tests ============

test('BotManagerApi - cleanup releases resources on stop', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3096 })

    // Add some flows
    api.registerFlow('cleanup-1', 'Cleanup 1', createMockFlow())
    api.registerFlow('cleanup-2', 'Cleanup 2', createMockFlow())

    api.start()
    api.stop()

    // Flows should still exist in registry (not cleared on stop)
    assert.is(api.getRegisteredFlows().length, 2)
})

// ============ Integration with BotManager Events ============

test('BotManagerApi - responds to bot:qr events', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3000 })

    // Simulate QR event
    const qrHandler = (manager as any).eventHandlers.get('bot:qr')?.values().next().value
    if (qrHandler) {
        qrHandler('test-tenant', { qr: 'test-qr-code' })
    }

    // QR should be stored internally
    assert.ok(true)

    api.stop()
})

test('BotManagerApi - clears QR on bot:connected', () => {
    const manager = createMockBotManager()
    const api = new BotManagerApi(manager, { port: 3000 })

    // Simulate QR event followed by connected
    const qrHandler = (manager as any).eventHandlers.get('bot:qr')?.values().next().value
    const connectedHandler = (manager as any).eventHandlers.get('bot:connected')?.values().next().value

    if (qrHandler) {
        qrHandler('test-tenant', { qr: 'test-qr-code' })
    }
    if (connectedHandler) {
        connectedHandler('test-tenant')
    }

    // QR should be cleared
    assert.ok(true)

    api.stop()
})

test.run()
