/**
 * @builderbot/manager
 * Multi-tenant bot manager for BuilderBot
 */

// Main classes
export { BotManager } from './bot-manager'
export { BotManagerApi } from './api'
export { FlowRegistry, type FlowDefinition } from './flow-registry'
export { RateLimiter, type RateLimiterConfig } from './rate-limiter'
export { PersistenceManager, getDefaultPersistence, resetDefaultPersistence } from './persistence'

// Schemas and validation
export {
    createBotSchema,
    updateBotSchema,
    sendMessageSchema,
    restartBotSchema,
    createFlowSchema,
    updateFlowSchema,
    validate,
} from './schemas'

// Types from types.ts
export type {
    TenantConfig,
    BotInstance,
    BotManagerConfig,
    BotStatus,
    BotManagerEvent,
    BotManagerEventHandler,
    Flow,
    ProviderClass,
    DatabaseClass,
    ProviderFactory,
    DatabaseFactory,
    ReconnectState,
} from './types'

// Types from schemas.ts
export type {
    CreateBotInput,
    UpdateBotInput,
    SendMessageInput,
    RestartBotInput,
    CreateFlowInput,
    UpdateFlowInput,
    FlowStep,
    ValidationResult,
} from './schemas'

// Types from persistence.ts
export type { SerializableBotConfig, PersistenceConfig } from './persistence'
