/**
 * OpenAPI 3.0 Specification for BotManager API
 */
export const openApiSpec = {
    openapi: '3.0.3',
    info: {
        title: 'BotManager API',
        description: 'Multi-tenant WhatsApp Bot Manager REST API. Manage bots, flows, and send messages.',
        version: '1.0.0',
        contact: {
            name: 'BotManager',
        },
    },
    servers: [
        {
            url: '/api',
            description: 'API Server',
        },
    ],
    tags: [
        { name: 'Health', description: 'Health check endpoints' },
        { name: 'Flows', description: 'Flow management' },
        { name: 'Bots', description: 'Bot management' },
    ],
    paths: {
        '/health': {
            get: {
                tags: ['Health'],
                summary: 'Health check',
                description: 'Check API health status',
                responses: {
                    '200': {
                        description: 'API is healthy',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string', example: 'ok' },
                                        timestamp: { type: 'string', format: 'date-time' },
                                        botsCount: { type: 'integer', example: 2 },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/flows': {
            get: {
                tags: ['Flows'],
                summary: 'List all flows',
                description: 'Get all registered flows (programmatic and dynamic)',
                responses: {
                    '200': {
                        description: 'List of flows',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        count: { type: 'integer' },
                                        flows: {
                                            type: 'array',
                                            items: { $ref: '#/components/schemas/FlowInfo' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            post: {
                tags: ['Flows'],
                summary: 'Create a dynamic flow',
                description: 'Create a new flow that can be used when creating bots',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/CreateFlow' },
                            examples: {
                                greeting: {
                                    summary: 'Greeting flow',
                                    value: {
                                        id: 'greeting',
                                        name: 'Greeting Flow',
                                        keyword: ['hola', 'hello', 'hi'],
                                        steps: [
                                            { answer: '👋 ¡Hola! Bienvenido', delay: 500 },
                                            { answer: '¿En qué puedo ayudarte?', capture: true },
                                        ],
                                    },
                                },
                                support: {
                                    summary: 'Support flow',
                                    value: {
                                        id: 'support',
                                        name: 'Support Flow',
                                        keyword: 'ayuda',
                                        steps: [
                                            { answer: '🆘 Soporte técnico' },
                                            { answer: 'Por favor describe tu problema:', capture: true },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '201': {
                        description: 'Flow created successfully',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/FlowResponse' },
                            },
                        },
                    },
                    '400': { $ref: '#/components/responses/ValidationError' },
                    '409': { $ref: '#/components/responses/Conflict' },
                },
            },
        },
        '/flows/{flowId}': {
            get: {
                tags: ['Flows'],
                summary: 'Get flow by ID',
                parameters: [{ $ref: '#/components/parameters/flowId' }],
                responses: {
                    '200': {
                        description: 'Flow details',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/FlowInfo' },
                            },
                        },
                    },
                    '404': { $ref: '#/components/responses/NotFound' },
                },
            },
            put: {
                tags: ['Flows'],
                summary: 'Update a dynamic flow',
                description: 'Update an existing dynamic flow. Programmatic flows cannot be updated.',
                parameters: [{ $ref: '#/components/parameters/flowId' }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/UpdateFlow' },
                            example: {
                                name: 'Updated Flow Name',
                                steps: [{ answer: 'New message', delay: 1000 }],
                            },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'Flow updated successfully',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/FlowResponse' },
                            },
                        },
                    },
                    '400': { $ref: '#/components/responses/ValidationError' },
                    '404': { $ref: '#/components/responses/NotFound' },
                },
            },
            delete: {
                tags: ['Flows'],
                summary: 'Delete a dynamic flow',
                description: 'Delete a dynamic flow. Programmatic flows cannot be deleted.',
                parameters: [{ $ref: '#/components/parameters/flowId' }],
                responses: {
                    '200': {
                        description: 'Flow deleted successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string' },
                                        flowId: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    '400': { $ref: '#/components/responses/BadRequest' },
                    '404': { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/bots': {
            get: {
                tags: ['Bots'],
                summary: 'List all bots',
                responses: {
                    '200': {
                        description: 'List of bots',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        count: { type: 'integer' },
                                        bots: {
                                            type: 'array',
                                            items: { $ref: '#/components/schemas/BotInfo' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            post: {
                tags: ['Bots'],
                summary: 'Create a new bot',
                description: 'Create a new WhatsApp bot instance',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/CreateBot' },
                            examples: {
                                simpleBot: {
                                    summary: 'Simple bot',
                                    value: {
                                        tenantId: 'my-bot',
                                        name: 'My WhatsApp Bot',
                                        flowIds: ['greeting', 'support'],
                                        port: 3008,
                                    },
                                },
                                minimalBot: {
                                    summary: 'Minimal bot',
                                    value: {
                                        tenantId: 'bot-2',
                                        flowIds: ['greeting'],
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '201': {
                        description: 'Bot created successfully',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/BotResponse' },
                            },
                        },
                    },
                    '400': { $ref: '#/components/responses/ValidationError' },
                    '409': { $ref: '#/components/responses/Conflict' },
                },
            },
        },
        '/bots/active': {
            get: {
                tags: ['Bots'],
                summary: 'List active (connected) bots',
                responses: {
                    '200': {
                        description: 'List of connected bots',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        count: { type: 'integer' },
                                        bots: {
                                            type: 'array',
                                            items: { $ref: '#/components/schemas/BotInfo' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/bots/{tenantId}': {
            get: {
                tags: ['Bots'],
                summary: 'Get bot by tenant ID',
                parameters: [{ $ref: '#/components/parameters/tenantId' }],
                responses: {
                    '200': {
                        description: 'Bot details',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/BotInfo' },
                            },
                        },
                    },
                    '404': { $ref: '#/components/responses/NotFound' },
                },
            },
            put: {
                tags: ['Bots'],
                summary: 'Update bot',
                parameters: [{ $ref: '#/components/parameters/tenantId' }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/UpdateBot' },
                            example: {
                                name: 'Updated Bot Name',
                            },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'Bot updated',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/BotResponse' },
                            },
                        },
                    },
                    '404': { $ref: '#/components/responses/NotFound' },
                },
            },
            delete: {
                tags: ['Bots'],
                summary: 'Delete bot',
                parameters: [{ $ref: '#/components/parameters/tenantId' }],
                responses: {
                    '200': {
                        description: 'Bot deleted successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string' },
                                        tenantId: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    '404': { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/bots/{tenantId}/qr': {
            get: {
                tags: ['Bots'],
                summary: 'Get QR code for bot',
                description: 'Get the QR code to connect WhatsApp. Returns null if already connected.',
                parameters: [{ $ref: '#/components/parameters/tenantId' }],
                responses: {
                    '200': {
                        description: 'QR code data',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: {
                                            type: 'string',
                                            enum: ['initializing', 'connected', 'disconnected', 'error'],
                                        },
                                        qr: { type: 'string', nullable: true },
                                        message: { type: 'string' },
                                    },
                                },
                                examples: {
                                    pending: {
                                        summary: 'QR available',
                                        value: {
                                            status: 'initializing',
                                            qr: '2@abc123...',
                                            message: 'Scan QR to connect',
                                        },
                                    },
                                    connected: {
                                        summary: 'Already connected',
                                        value: {
                                            status: 'connected',
                                            qr: null,
                                        },
                                    },
                                },
                            },
                        },
                    },
                    '404': { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/bots/{tenantId}/restart': {
            post: {
                tags: ['Bots'],
                summary: 'Restart bot',
                parameters: [{ $ref: '#/components/parameters/tenantId' }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/RestartBot' },
                            example: {
                                flowIds: ['greeting', 'support'],
                                port: 3009,
                            },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'Bot restarted',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string' },
                                        tenantId: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    '400': { $ref: '#/components/responses/ValidationError' },
                    '404': { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/bots/{tenantId}/stop': {
            post: {
                tags: ['Bots'],
                summary: 'Stop bot',
                description: 'Stop and remove the bot',
                parameters: [{ $ref: '#/components/parameters/tenantId' }],
                responses: {
                    '200': {
                        description: 'Bot stopped',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    '404': { $ref: '#/components/responses/NotFound' },
                },
            },
        },
    },
    components: {
        parameters: {
            tenantId: {
                name: 'tenantId',
                in: 'path',
                required: true,
                description: 'Bot tenant identifier',
                schema: { type: 'string' },
                example: 'my-bot',
            },
            flowId: {
                name: 'flowId',
                in: 'path',
                required: true,
                description: 'Flow identifier',
                schema: { type: 'string' },
                example: 'greeting',
            },
        },
        schemas: {
            FlowStep: {
                type: 'object',
                required: ['answer'],
                properties: {
                    answer: { type: 'string', description: 'Message to send', maxLength: 4096 },
                    delay: { type: 'integer', description: 'Delay in ms before sending', minimum: 0, maximum: 30000 },
                    media: { type: 'string', format: 'uri', description: 'Media URL to attach' },
                    capture: { type: 'boolean', description: 'Whether to capture user response' },
                },
            },
            CreateFlow: {
                type: 'object',
                required: ['id', 'name', 'keyword', 'steps'],
                properties: {
                    id: { type: 'string', pattern: '^[a-zA-Z0-9-_]+$', maxLength: 50 },
                    name: { type: 'string', maxLength: 100 },
                    keyword: {
                        oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' }, minItems: 1 }],
                    },
                    steps: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/FlowStep' },
                        minItems: 1,
                    },
                },
            },
            UpdateFlow: {
                type: 'object',
                properties: {
                    name: { type: 'string', maxLength: 100 },
                    keyword: {
                        oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' }, minItems: 1 }],
                    },
                    steps: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/FlowStep' },
                        minItems: 1,
                    },
                },
            },
            FlowInfo: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    dynamic: { type: 'boolean' },
                    config: { $ref: '#/components/schemas/CreateFlow' },
                },
            },
            FlowResponse: {
                type: 'object',
                properties: {
                    message: { type: 'string' },
                    id: { type: 'string' },
                    name: { type: 'string' },
                    dynamic: { type: 'boolean' },
                    config: { $ref: '#/components/schemas/CreateFlow' },
                },
            },
            CreateBot: {
                type: 'object',
                required: ['tenantId', 'flowIds'],
                properties: {
                    tenantId: { type: 'string', pattern: '^[a-zA-Z0-9-_]+$', maxLength: 50 },
                    name: { type: 'string', maxLength: 100 },
                    flowIds: {
                        type: 'array',
                        items: { type: 'string' },
                        minItems: 1,
                        description: 'At least one flowId is required',
                    },
                    port: { type: 'integer', minimum: 1024, maximum: 65535 },
                    providerOptions: { type: 'object', additionalProperties: true },
                },
            },
            UpdateBot: {
                type: 'object',
                properties: {
                    name: { type: 'string', maxLength: 100 },
                },
            },
            RestartBot: {
                type: 'object',
                required: ['flowIds'],
                properties: {
                    flowIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
                    port: { type: 'integer', minimum: 1024, maximum: 65535 },
                    name: { type: 'string', maxLength: 100 },
                },
            },
            BotInfo: {
                type: 'object',
                properties: {
                    tenantId: { type: 'string' },
                    name: { type: 'string' },
                    status: { type: 'string', enum: ['initializing', 'connected', 'disconnected', 'error'] },
                    port: { type: 'integer' },
                    createdAt: { type: 'string', format: 'date-time' },
                    uptime: { type: 'integer', description: 'Uptime in milliseconds' },
                },
            },
            BotResponse: {
                type: 'object',
                properties: {
                    message: { type: 'string' },
                    tenantId: { type: 'string' },
                    name: { type: 'string' },
                    status: { type: 'string' },
                    port: { type: 'integer' },
                },
            },
            Error: {
                type: 'object',
                properties: {
                    error: { type: 'string' },
                    details: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                field: { type: 'string' },
                                message: { type: 'string' },
                            },
                        },
                    },
                },
            },
        },
        responses: {
            NotFound: {
                description: 'Resource not found',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: { error: 'Bot not found' },
                    },
                },
            },
            ValidationError: {
                description: 'Validation error',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: {
                            error: 'Validation failed',
                            details: [{ field: 'tenantId', message: 'tenantId is required' }],
                        },
                    },
                },
            },
            BadRequest: {
                description: 'Bad request',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: { error: 'Cannot delete programmatic flows' },
                    },
                },
            },
            Conflict: {
                description: 'Resource already exists',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: { error: 'Bot with this tenantId already exists' },
                    },
                },
            },
            Unauthorized: {
                description: 'Unauthorized',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Error' },
                        example: { error: 'Unauthorized' },
                    },
                },
            },
        },
        securitySchemes: {
            ApiKeyAuth: {
                type: 'apiKey',
                in: 'header',
                name: 'X-API-Key',
            },
            BearerAuth: {
                type: 'http',
                scheme: 'bearer',
            },
        },
    },
    security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
}

/**
 * Generate Swagger UI HTML
 */
export function generateSwaggerHtml(specUrl: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BotManager API - Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { font-size: 2rem; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '${specUrl}',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        tryItOutEnabled: true,
        supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
        validatorUrl: null
      });
    };
  </script>
</body>
</html>`
}
