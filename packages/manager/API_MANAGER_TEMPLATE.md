# 📚 Plantilla: Cómo Funciona el API Manager

Esta plantilla explica el funcionamiento del **BotManagerApi** basado en los tests y el código fuente del proyecto.

---

## 🎯 Visión General

El `BotManagerApi` es una API REST construida con **Polka** que permite gestionar bots de WhatsApp de forma multi-tenant mediante endpoints HTTP. Proporciona funcionalidades para:

- ✅ Gestión de **Flows** (flujos de conversación)
- ✅ Gestión de **Bots** (instancias de WhatsApp)
- ✅ Monitoreo de salud del sistema
- ✅ Documentación Swagger/OpenAPI integrada
- ✅ Rate limiting opcional
- ✅ Autenticación por API Key opcional

---

## 🏗️ Arquitectura

### Componentes Principales

```
BotManagerApi
├── BotManager          # Gestiona las instancias de bots
├── FlowRegistry        # Registro de flujos (programáticos y dinámicos)
├── RateLimiter         # Control de tasa de peticiones (opcional)
└── QR Codes Storage    # Almacenamiento temporal de códigos QR
```

### Flujo de Inicialización

```typescript
// 1. Crear instancia de BotManager
const manager = new BotManager(config)

// 2. Crear instancia de BotManagerApi
const api = new BotManagerApi(manager, {
    port: 3000,
    apiKey: 'opcional-api-key',
    rateLimit: { maxRequests: 100, windowMs: 60000 } // opcional
})

// 3. Registrar flows programáticos (opcional)
api.registerFlow('flow-id', 'Flow Name', flowInstance)

// 4. Iniciar servidor
api.start()
```

---

## 🔌 Endpoints de la API

### 📊 Health Check

#### `GET /api/health`

Verifica el estado de salud del sistema.

**Respuesta:**
```json
{
  "status": "healthy",
  "bots": {
    "total": 2,
    "connected": 1,
    "disconnected": 0,
    "error": 0,
    "initializing": 1
  },
  "memory": { ... },
  "uptime": 12345,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "flows": 5,
  "rateLimiter": { ... }
}
```

---

### 🔄 Flows (Flujos)

Los flows pueden ser de dos tipos:
- **Programáticos**: Creados mediante código usando `registerFlow()`
- **Dinámicos**: Creados mediante API usando JSON

#### `GET /api/flows`

Lista todos los flows registrados.

**Respuesta:**
```json
{
  "count": 2,
  "flows": [
    {
      "id": "greeting-flow",
      "name": "Greeting Flow",
      "dynamic": true,
      "config": { ... },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### `POST /api/flows`

Crea un nuevo flow dinámico.

**Body:**
```json
{
  "id": "greeting",
  "name": "Greeting Flow",
  "keyword": "hello",  // o ["hello", "hi", "hey"]
  "steps": [
    {
      "answer": "Hello! How can I help you?",
      "delay": 0,
      "media": "https://example.com/image.jpg",  // opcional
      "capture": false  // opcional
    },
    {
      "answer": "What would you like to know?",
      "delay": 1000,
      "capture": true
    }
  ]
}
```

**Respuesta (201):**
```json
{
  "message": "Flow created successfully",
  "id": "greeting",
  "name": "Greeting Flow",
  "dynamic": true,
  "config": { ... },
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Errores:**
- `400`: Validación fallida
- `409`: Flow con ese ID ya existe

#### `GET /api/flows/:flowId`

Obtiene un flow específico por ID.

**Respuesta (200):**
```json
{
  "id": "greeting",
  "name": "Greeting Flow",
  "dynamic": true,
  "config": { ... },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Errores:**
- `404`: Flow no encontrado

#### `PUT /api/flows/:flowId`

Actualiza un flow dinámico existente.

**Body:**
```json
{
  "name": "Updated Flow Name",  // opcional
  "keyword": "new-keyword",      // opcional
  "steps": [ ... ]               // opcional
}
```

**Respuesta (200):**
```json
{
  "message": "Flow updated successfully",
  "id": "greeting",
  "name": "Updated Flow Name",
  "dynamic": true,
  "config": { ... },
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Errores:**
- `400`: Flow no es dinámico (solo dinámicos se pueden actualizar)
- `404`: Flow no encontrado

#### `DELETE /api/flows/:flowId`

Elimina un flow dinámico.

**Respuesta (200):**
```json
{
  "message": "Flow deleted successfully",
  "flowId": "greeting"
}
```

**Errores:**
- `400`: Flow no es dinámico (solo dinámicos se pueden eliminar)
- `404`: Flow no encontrado

---

### 🤖 Bots

#### `GET /api/bots`

Lista todos los bots registrados.

**Respuesta:**
```json
{
  "count": 2,
  "bots": [
    {
      "tenantId": "tenant-1",
      "name": "Bot 1",
      "status": "connected",
      "port": 3001,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "uptime": 123456,
      "providerType": "BaileysProvider",
      "databaseType": "MemoryDB"
    }
  ]
}
```

#### `POST /api/bots`

Crea un nuevo bot.

**Body:**
```json
{
  "tenantId": "tenant-1",
  "name": "My Bot",  // opcional
  "flowIds": ["greeting", "support"],
  "port": 3001,  // opcional
  "providerOptions": {  // opcional
    "timeout": 5000
  }
}
```

**Respuesta (201):**
```json
{
  "message": "Bot created successfully",
  "tenantId": "tenant-1",
  "name": "My Bot",
  "status": "initializing",
  "port": 3001,
  "flowsUsed": ["greeting", "support"],
  "providerType": "BaileysProvider",
  "databaseType": "MemoryDB"
}
```

**Errores:**
- `400`: Validación fallida o flows no encontrados
- `409`: Bot con ese tenantId ya existe
- `500`: Error al crear el bot

#### `GET /api/bots/:tenantId`

Obtiene información de un bot específico.

**Respuesta (200):**
```json
{
  "tenantId": "tenant-1",
  "name": "My Bot",
  "status": "connected",
  "port": 3001,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "uptime": 123456,
  "providerType": "BaileysProvider",
  "databaseType": "MemoryDB",
  "reconnectState": null
}
```

**Errores:**
- `404`: Bot no encontrado

#### `PUT /api/bots/:tenantId`

Actualiza un bot (solo nombre por ahora).

**Body:**
```json
{
  "name": "Updated Bot Name"
}
```

**Respuesta (200):**
```json
{
  "message": "Bot updated",
  "tenantId": "tenant-1",
  "name": "Updated Bot Name"
}
```

**Errores:**
- `400`: Validación fallida
- `404`: Bot no encontrado

#### `DELETE /api/bots/:tenantId`

Elimina un bot.

**Respuesta (200):**
```json
{
  "message": "Bot removed successfully",
  "tenantId": "tenant-1"
}
```

**Errores:**
- `404`: Bot no encontrado

#### `GET /api/bots/:tenantId/qr`

Obtiene el código QR para conectar el bot (si está en estado `initializing`).

**Respuesta (200):**
```json
{
  "status": "initializing",
  "qr": "data:image/png;base64,iVBORw0KGgo...",
  "message": "Scan QR to connect"
}
```

O si ya está conectado:
```json
{
  "status": "connected",
  "qr": null
}
```

**Errores:**
- `404`: Bot no encontrado

#### `POST /api/bots/:tenantId/restart`

Reinicia un bot con nueva configuración.

**Body:**
```json
{
  "flowIds": ["new-flow-1", "new-flow-2"],
  "port": 3002,  // opcional
  "name": "New Bot Name"  // opcional
}
```

**Respuesta (200):**
```json
{
  "message": "Bot restarted",
  "tenantId": "tenant-1",
  "status": "initializing"
}
```

**Errores:**
- `400`: Validación fallida o flows no encontrados
- `404`: Bot no encontrado
- `500`: Error al reiniciar

#### `POST /api/bots/:tenantId/reconnect`

Inicia reconexión manual de un bot.

**Respuesta (200):**
```json
{
  "success": true,
  "message": "Bot reconnection initiated"
}
```

**Errores:**
- `404`: Bot no encontrado o sin configuración almacenada

#### `POST /api/bots/:tenantId/stop`

Detiene un bot (equivalente a DELETE).

**Respuesta (200):**
```json
{
  "success": true,
  "message": "Bot stopped"
}
```

**Errores:**
- `404`: Bot no encontrado

---

## 🔐 Autenticación

Si se configura una `apiKey` en el constructor, todos los endpoints (excepto `/docs` y `/api/docs/*`) requieren autenticación.

**Headers requeridos:**
```
X-API-Key: tu-api-key
```
o
```
Authorization: Bearer tu-api-key
```

**Respuesta sin autenticación (401):**
```json
{
  "error": "Unauthorized"
}
```

---

## 🛡️ Rate Limiting

El rate limiting es opcional y se configura en el constructor:

```typescript
const api = new BotManagerApi(manager, {
    port: 3000,
    rateLimit: {
        maxRequests: 100,    // Máximo de peticiones
        windowMs: 60000     // Ventana de tiempo en ms (60 segundos)
    }
})
```

Para deshabilitar:
```typescript
rateLimit: false
```

---

## 📖 Documentación Swagger

### `GET /docs`

Interfaz Swagger UI para explorar la API.

### `GET /api/docs/openapi.json`

Especificación OpenAPI 3.0.3 en formato JSON.

---

## 💻 Uso Programático

### Registrar Flows Programáticos

```typescript
import { createFlow } from '@builderbot/bot'

const greetingFlow = createFlow()
  .addAnswer('Hello!')
  .addAnswer('How can I help?')

api.registerFlow('greeting', 'Greeting Flow', greetingFlow)
```

### Obtener Flows Registrados

```typescript
// Todos los flows
const allFlows = api.getRegisteredFlows()

// Flow específico
const flow = api.getFlow('greeting')

// Acceso directo al registry
const registry = api.getFlowRegistry()
```

### Gestión del Servidor

```typescript
// Iniciar
api.start()

// Detener
api.stop()
```

---

## 🔄 Flujo de Trabajo Típico

### 1. Crear Flows Dinámicos

```bash
POST /api/flows
{
  "id": "greeting",
  "name": "Greeting",
  "keyword": "hello",
  "steps": [
    { "answer": "Hello!" }
  ]
}
```

### 2. Crear Bot con Flows

```bash
POST /api/bots
{
  "tenantId": "tenant-1",
  "name": "My Bot",
  "flowIds": ["greeting"]
}
```

### 3. Obtener QR para Conectar

```bash
GET /api/bots/tenant-1/qr
```

### 4. Monitorear Estado

```bash
GET /api/bots/tenant-1
GET /api/health
```

### 5. Actualizar o Reiniciar

```bash
# Actualizar flow
PUT /api/flows/greeting
{
  "steps": [
    { "answer": "Hello! Updated" }
  ]
}

# Reiniciar bot con nuevos flows
POST /api/bots/tenant-1/restart
{
  "flowIds": ["greeting", "support"]
}
```

---

## 📝 Estados de Bot

Los bots pueden tener los siguientes estados:

- `initializing`: Bot iniciándose, generando QR
- `connected`: Bot conectado y funcionando
- `disconnected`: Bot desconectado
- `error`: Bot en estado de error

---

## 🧪 Ejemplos de Tests

### Test de Creación de API

```typescript
const manager = createMockBotManager()
const api = new BotManagerApi(manager, { port: 3000 })
api.start()
// ... usar API
api.stop()
```

### Test de Registro de Flows

```typescript
const mockFlow = createMockFlow()
api.registerFlow('test-flow', 'Test Flow', mockFlow)

const flows = api.getRegisteredFlows()
assert.is(flows.length, 1)
```

### Test de Creación de Bot

```typescript
await api.handleCreateBot(mockRequest, mockResponse)
// Verificar que el bot fue creado en el manager
```

---

## ⚠️ Consideraciones Importantes

1. **Flows Programáticos vs Dinámicos:**
   - Los flows programáticos se registran con `registerFlow()` y NO se pueden actualizar/eliminar vía API
   - Los flows dinámicos se crean vía API y SÍ se pueden actualizar/eliminar

2. **QR Codes:**
   - Se almacenan temporalmente cuando el bot está en estado `initializing`
   - Se eliminan automáticamente cuando el bot se conecta

3. **Validación:**
   - Todos los endpoints POST/PUT validan el body con schemas Zod
   - Los errores de validación retornan detalles específicos

4. **Rate Limiting:**
   - Se aplica a todas las rutas excepto `/docs` y `/api/docs/*`
   - Las estadísticas están disponibles en `/api/health`

5. **CORS:**
   - Habilitado por defecto para todos los orígenes (`*`)
   - Métodos permitidos: GET, POST, PUT, DELETE, OPTIONS

---

## 🔗 Referencias

- **Código fuente:** `packages/manager/src/api.ts`
- **Tests:** `packages/manager/__tests__/api.test.ts`
- **BotManager:** `packages/manager/src/bot-manager.ts`
- **FlowRegistry:** `packages/manager/src/flow-registry.ts`
- **Schemas:** `packages/manager/src/schemas.ts`
- **Swagger:** `packages/manager/src/swagger.ts`

---

## 📌 Resumen de Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/flows` | Listar flows |
| POST | `/api/flows` | Crear flow dinámico |
| GET | `/api/flows/:flowId` | Obtener flow |
| PUT | `/api/flows/:flowId` | Actualizar flow dinámico |
| DELETE | `/api/flows/:flowId` | Eliminar flow dinámico |
| GET | `/api/bots` | Listar bots |
| POST | `/api/bots` | Crear bot |
| GET | `/api/bots/:tenantId` | Obtener bot |
| PUT | `/api/bots/:tenantId` | Actualizar bot |
| DELETE | `/api/bots/:tenantId` | Eliminar bot |
| GET | `/api/bots/:tenantId/qr` | Obtener QR |
| POST | `/api/bots/:tenantId/restart` | Reiniciar bot |
| POST | `/api/bots/:tenantId/reconnect` | Reconectar bot |
| POST | `/api/bots/:tenantId/stop` | Detener bot |
| GET | `/docs` | Swagger UI |
| GET | `/api/docs/openapi.json` | OpenAPI spec |

---

**Última actualización:** Basado en los tests y código fuente del proyecto builderbot.

