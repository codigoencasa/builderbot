# @builderbot/manager

Multi-tenant bot manager for BuilderBot. Manage multiple WhatsApp bot instances, each with its own session, flows, and configuration.

## Features

- **Multi-tenant Support**: Run multiple WhatsApp bots simultaneously
- **Isolated Sessions**: Each tenant gets its own session storage
- **REST API**: Built-in API for managing bots via HTTP
- **Dynamic Flows**: Create and manage flows via API
- **Event System**: Subscribe to bot lifecycle events
- **Swagger UI**: Auto-generated API documentation

## Installation

```bash
pnpm add @builderbot/manager
```

## Quick Start

```typescript
import { BotManager, BotManagerApi } from '@builderbot/manager'
import { addKeyword } from '@builderbot/bot'

// Create the manager
const manager = new BotManager({
  sessionsDir: './sessions'
})

// Create the API server
const api = new BotManagerApi(manager, {
  port: 3000,
  apiKey: 'your-secret-key' // optional
})

// Register a flow
const greetingFlow = addKeyword(['hola', 'hello'])
  .addAnswer('¡Hola! Bienvenido')
  .addAnswer('¿En qué puedo ayudarte?')

api.registerFlow('greeting', 'Greeting Flow', greetingFlow)

// Start the API
api.start()
```

## API Endpoints

### Health
- `GET /api/health` - Health check

### Flows
- `GET /api/flows` - List all flows
- `POST /api/flows` - Create a dynamic flow
- `GET /api/flows/:flowId` - Get flow by ID
- `PUT /api/flows/:flowId` - Update a dynamic flow
- `DELETE /api/flows/:flowId` - Delete a dynamic flow

### Bots
- `GET /api/bots` - List all bots
- `POST /api/bots` - Create a new bot
- `GET /api/bots/:tenantId` - Get bot by tenant ID
- `PUT /api/bots/:tenantId` - Update bot
- `DELETE /api/bots/:tenantId` - Delete bot
- `GET /api/bots/:tenantId/qr` - Get QR code
- `POST /api/bots/:tenantId/restart` - Restart bot
- `POST /api/bots/:tenantId/stop` - Stop bot

### Documentation
- `GET /docs` - Swagger UI

## Creating Bots via API

```bash
# Create a flow first
curl -X POST http://localhost:3000/api/flows \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{
    "id": "greeting",
    "name": "Greeting Flow",
    "keyword": ["hola", "hello"],
    "steps": [
      { "answer": "¡Hola! Bienvenido", "delay": 500 },
      { "answer": "¿En qué puedo ayudarte?" }
    ]
  }'

# Create a bot using the flow
curl -X POST http://localhost:3000/api/bots \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{
    "tenantId": "my-bot",
    "name": "My WhatsApp Bot",
    "flowIds": ["greeting"],
    "port": 3008
  }'

# Get QR code to connect
curl http://localhost:3000/api/bots/my-bot/qr \
  -H "X-API-Key: your-secret-key"
```

## Event Handling

```typescript
manager.on('bot:created', (tenantId, data) => {
  console.log(`Bot ${tenantId} created`)
})

manager.on('bot:connected', (tenantId) => {
  console.log(`Bot ${tenantId} connected to WhatsApp`)
})

manager.on('bot:qr', (tenantId, data) => {
  console.log(`QR for ${tenantId}:`, data.qr)
})

manager.on('bot:disconnected', (tenantId) => {
  console.log(`Bot ${tenantId} disconnected`)
})

manager.on('bot:error', (tenantId, data) => {
  console.error(`Error in bot ${tenantId}:`, data.error)
})
```

## Programmatic Usage

```typescript
// Create a bot programmatically
const bot = await manager.createBot({
  tenantId: 'tenant-1',
  name: 'Tenant 1 Bot',
  flows: [greetingFlow],
  port: 3001
})

// Get bot info
const info = manager.getBot('tenant-1')

// Get all bots summary
const allBots = manager.getBotsInfo()

// Send a message
await manager.sendMessage('tenant-1', '1234567890', 'Hello!')

// Remove a bot
await manager.removeBot('tenant-1')

// Shutdown all bots
await manager.shutdown()
```

## License

ISC

