import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { openApiSpec, generateSwaggerHtml } from '../src/swagger'

// ============ OpenAPI Spec Structure Tests ============

test('openApiSpec - has correct version', () => {
    assert.is(openApiSpec.openapi, '3.0.3')
})

test('openApiSpec - has info section', () => {
    assert.ok(openApiSpec.info)
    assert.is(openApiSpec.info.title, 'BotManager API')
    assert.ok(openApiSpec.info.description)
    assert.ok(openApiSpec.info.version)
})

test('openApiSpec - has servers section', () => {
    assert.ok(openApiSpec.servers)
    assert.ok(Array.isArray(openApiSpec.servers))
    assert.ok(openApiSpec.servers.length > 0)
    assert.is(openApiSpec.servers[0].url, '/api')
})

test('openApiSpec - has tags section', () => {
    assert.ok(openApiSpec.tags)
    assert.ok(Array.isArray(openApiSpec.tags))

    const tagNames = openApiSpec.tags.map((t: any) => t.name)
    assert.ok(tagNames.includes('Health'))
    assert.ok(tagNames.includes('Flows'))
    assert.ok(tagNames.includes('Bots'))
})

// ============ Paths Tests ============

test('openApiSpec - has paths section', () => {
    assert.ok(openApiSpec.paths)
    assert.ok(typeof openApiSpec.paths === 'object')
})

test('openApiSpec - has /health endpoint', () => {
    assert.ok(openApiSpec.paths['/health'])
    assert.ok(openApiSpec.paths['/health'].get)
    assert.ok(openApiSpec.paths['/health'].get.responses['200'])
})

test('openApiSpec - has /flows endpoints', () => {
    assert.ok(openApiSpec.paths['/flows'])
    assert.ok(openApiSpec.paths['/flows'].get)
    assert.ok(openApiSpec.paths['/flows'].post)
})

test('openApiSpec - has /flows/{flowId} endpoints', () => {
    assert.ok(openApiSpec.paths['/flows/{flowId}'])
    assert.ok(openApiSpec.paths['/flows/{flowId}'].get)
    assert.ok(openApiSpec.paths['/flows/{flowId}'].put)
    assert.ok(openApiSpec.paths['/flows/{flowId}'].delete)
})

test('openApiSpec - has /bots endpoints', () => {
    assert.ok(openApiSpec.paths['/bots'])
    assert.ok(openApiSpec.paths['/bots'].get)
    assert.ok(openApiSpec.paths['/bots'].post)
})

test('openApiSpec - has /bots/{tenantId} endpoints', () => {
    assert.ok(openApiSpec.paths['/bots/{tenantId}'])
    assert.ok(openApiSpec.paths['/bots/{tenantId}'].get)
    assert.ok(openApiSpec.paths['/bots/{tenantId}'].put)
    assert.ok(openApiSpec.paths['/bots/{tenantId}'].delete)
})

test('openApiSpec - has /bots/{tenantId}/qr endpoint', () => {
    assert.ok(openApiSpec.paths['/bots/{tenantId}/qr'])
    assert.ok(openApiSpec.paths['/bots/{tenantId}/qr'].get)
})

test('openApiSpec - has /bots/{tenantId}/restart endpoint', () => {
    assert.ok(openApiSpec.paths['/bots/{tenantId}/restart'])
    assert.ok(openApiSpec.paths['/bots/{tenantId}/restart'].post)
})

test('openApiSpec - has /bots/{tenantId}/stop endpoint', () => {
    assert.ok(openApiSpec.paths['/bots/{tenantId}/stop'])
    assert.ok(openApiSpec.paths['/bots/{tenantId}/stop'].post)
})

test('openApiSpec - has /bots/active endpoint', () => {
    assert.ok(openApiSpec.paths['/bots/active'])
    assert.ok(openApiSpec.paths['/bots/active'].get)
})

// ============ Components Tests ============

test('openApiSpec - has components section', () => {
    assert.ok(openApiSpec.components)
})

test('openApiSpec - has parameters components', () => {
    assert.ok(openApiSpec.components.parameters)
    assert.ok(openApiSpec.components.parameters.tenantId)
    assert.ok(openApiSpec.components.parameters.flowId)
})

test('openApiSpec - tenantId parameter is correctly defined', () => {
    const tenantIdParam = openApiSpec.components.parameters.tenantId
    assert.is(tenantIdParam.name, 'tenantId')
    assert.is(tenantIdParam.in, 'path')
    assert.is(tenantIdParam.required, true)
    assert.ok(tenantIdParam.schema)
})

test('openApiSpec - flowId parameter is correctly defined', () => {
    const flowIdParam = openApiSpec.components.parameters.flowId
    assert.is(flowIdParam.name, 'flowId')
    assert.is(flowIdParam.in, 'path')
    assert.is(flowIdParam.required, true)
    assert.ok(flowIdParam.schema)
})

// ============ Schemas Tests ============

test('openApiSpec - has schemas components', () => {
    assert.ok(openApiSpec.components.schemas)
})

test('openApiSpec - has FlowStep schema', () => {
    const schema = openApiSpec.components.schemas.FlowStep
    assert.ok(schema)
    assert.is(schema.type, 'object')
    assert.ok(schema.required?.includes('answer'))
    assert.ok(schema.properties.answer)
    assert.ok(schema.properties.delay)
    assert.ok(schema.properties.media)
    assert.ok(schema.properties.capture)
})

test('openApiSpec - has CreateFlow schema', () => {
    const schema = openApiSpec.components.schemas.CreateFlow
    assert.ok(schema)
    assert.is(schema.type, 'object')
    assert.ok(schema.required?.includes('id'))
    assert.ok(schema.required?.includes('name'))
    assert.ok(schema.required?.includes('keyword'))
    assert.ok(schema.required?.includes('steps'))
    assert.ok(schema.properties.id)
    assert.ok(schema.properties.name)
    assert.ok(schema.properties.keyword)
    assert.ok(schema.properties.steps)
})

test('openApiSpec - has UpdateFlow schema', () => {
    const schema = openApiSpec.components.schemas.UpdateFlow
    assert.ok(schema)
    assert.is(schema.type, 'object')
    assert.ok(schema.properties.name)
    assert.ok(schema.properties.keyword)
    assert.ok(schema.properties.steps)
})

test('openApiSpec - has FlowInfo schema', () => {
    const schema = openApiSpec.components.schemas.FlowInfo
    assert.ok(schema)
    assert.ok(schema.properties.id)
    assert.ok(schema.properties.name)
    assert.ok(schema.properties.dynamic)
})

test('openApiSpec - has FlowResponse schema', () => {
    const schema = openApiSpec.components.schemas.FlowResponse
    assert.ok(schema)
    assert.ok(schema.properties.message)
    assert.ok(schema.properties.id)
    assert.ok(schema.properties.name)
})

test('openApiSpec - has CreateBot schema', () => {
    const schema = openApiSpec.components.schemas.CreateBot
    assert.ok(schema)
    assert.is(schema.type, 'object')
    assert.ok(schema.required?.includes('tenantId'))
    assert.ok(schema.required?.includes('flowIds'))
    assert.ok(schema.properties.tenantId)
    assert.ok(schema.properties.name)
    assert.ok(schema.properties.flowIds)
    assert.ok(schema.properties.port)
})

test('openApiSpec - has UpdateBot schema', () => {
    const schema = openApiSpec.components.schemas.UpdateBot
    assert.ok(schema)
    assert.ok(schema.properties.name)
})

test('openApiSpec - has RestartBot schema', () => {
    const schema = openApiSpec.components.schemas.RestartBot
    assert.ok(schema)
    assert.ok(schema.required?.includes('flowIds'))
    assert.ok(schema.properties.flowIds)
    assert.ok(schema.properties.port)
    assert.ok(schema.properties.name)
})

test('openApiSpec - has BotInfo schema', () => {
    const schema = openApiSpec.components.schemas.BotInfo
    assert.ok(schema)
    assert.ok(schema.properties.tenantId)
    assert.ok(schema.properties.name)
    assert.ok(schema.properties.status)
    assert.ok(schema.properties.port)
    assert.ok(schema.properties.createdAt)
    assert.ok(schema.properties.uptime)
})

test('openApiSpec - has BotResponse schema', () => {
    const schema = openApiSpec.components.schemas.BotResponse
    assert.ok(schema)
    assert.ok(schema.properties.message)
    assert.ok(schema.properties.tenantId)
    assert.ok(schema.properties.name)
    assert.ok(schema.properties.status)
})

test('openApiSpec - has Error schema', () => {
    const schema = openApiSpec.components.schemas.Error
    assert.ok(schema)
    assert.ok(schema.properties.error)
    assert.ok(schema.properties.details)
})

// ============ Responses Tests ============

test('openApiSpec - has responses components', () => {
    assert.ok(openApiSpec.components.responses)
})

test('openApiSpec - has NotFound response', () => {
    const response = openApiSpec.components.responses.NotFound
    assert.ok(response)
    assert.is(response.description, 'Resource not found')
    assert.ok(response.content['application/json'])
})

test('openApiSpec - has ValidationError response', () => {
    const response = openApiSpec.components.responses.ValidationError
    assert.ok(response)
    assert.is(response.description, 'Validation error')
})

test('openApiSpec - has BadRequest response', () => {
    const response = openApiSpec.components.responses.BadRequest
    assert.ok(response)
    assert.is(response.description, 'Bad request')
})

test('openApiSpec - has Conflict response', () => {
    const response = openApiSpec.components.responses.Conflict
    assert.ok(response)
    assert.is(response.description, 'Resource already exists')
})

test('openApiSpec - has Unauthorized response', () => {
    const response = openApiSpec.components.responses.Unauthorized
    assert.ok(response)
    assert.is(response.description, 'Unauthorized')
})

// ============ Security Tests ============

test('openApiSpec - has securitySchemes', () => {
    assert.ok(openApiSpec.components.securitySchemes)
})

test('openApiSpec - has ApiKeyAuth scheme', () => {
    const scheme = openApiSpec.components.securitySchemes.ApiKeyAuth
    assert.ok(scheme)
    assert.is(scheme.type, 'apiKey')
    assert.is(scheme.in, 'header')
    assert.is(scheme.name, 'X-API-Key')
})

test('openApiSpec - has BearerAuth scheme', () => {
    const scheme = openApiSpec.components.securitySchemes.BearerAuth
    assert.ok(scheme)
    assert.is(scheme.type, 'http')
    assert.is(scheme.scheme, 'bearer')
})

test('openApiSpec - has global security', () => {
    assert.ok(openApiSpec.security)
    assert.ok(Array.isArray(openApiSpec.security))
})

// ============ Endpoint Details Tests ============

test('openApiSpec - health endpoint has correct response structure', () => {
    const healthGet = openApiSpec.paths['/health'].get
    assert.ok(healthGet.responses['200'].content['application/json'])

    const schema = healthGet.responses['200'].content['application/json'].schema
    assert.ok(schema.properties.status)
    assert.ok(schema.properties.timestamp)
})

test('openApiSpec - create bot has examples', () => {
    const createBot = openApiSpec.paths['/bots'].post
    const requestBody = createBot.requestBody.content['application/json']

    assert.ok(requestBody.examples)
    assert.ok(requestBody.examples.simpleBot)
    assert.ok(requestBody.examples.minimalBot)
})

test('openApiSpec - create flow has examples', () => {
    const createFlow = openApiSpec.paths['/flows'].post
    const requestBody = createFlow.requestBody.content['application/json']

    assert.ok(requestBody.examples)
    assert.ok(requestBody.examples.greeting)
    assert.ok(requestBody.examples.support)
})

test('openApiSpec - qr endpoint has multiple examples', () => {
    const qrGet = openApiSpec.paths['/bots/{tenantId}/qr'].get
    const examples = qrGet.responses['200'].content['application/json'].examples

    assert.ok(examples.pending)
    assert.ok(examples.connected)
})

test('openApiSpec - bot status enum is correct', () => {
    const qrSchema = openApiSpec.paths['/bots/{tenantId}/qr'].get.responses['200'].content['application/json'].schema
    assert.ok(qrSchema.properties.status.enum)

    const statusEnum = qrSchema.properties.status.enum
    assert.ok(statusEnum.includes('initializing'))
    assert.ok(statusEnum.includes('connected'))
    assert.ok(statusEnum.includes('disconnected'))
    assert.ok(statusEnum.includes('error'))
})

// ============ generateSwaggerHtml Tests ============

test('generateSwaggerHtml - returns valid HTML', () => {
    const html = generateSwaggerHtml('/api/docs/openapi.json')

    assert.ok(html.includes('<!DOCTYPE html>'))
    assert.ok(html.includes('<html'))
    assert.ok(html.includes('</html>'))
})

test('generateSwaggerHtml - includes Swagger UI CDN', () => {
    const html = generateSwaggerHtml('/api/docs/openapi.json')

    assert.ok(html.includes('swagger-ui-dist'))
    assert.ok(html.includes('swagger-ui.css'))
    assert.ok(html.includes('swagger-ui-bundle.js'))
})

test('generateSwaggerHtml - uses provided spec URL', () => {
    const html = generateSwaggerHtml('/custom/spec.json')

    assert.ok(html.includes('/custom/spec.json'))
})

test('generateSwaggerHtml - includes title', () => {
    const html = generateSwaggerHtml('/api/docs/openapi.json')

    assert.ok(html.includes('BotManager API'))
    assert.ok(html.includes('<title>'))
})

test('generateSwaggerHtml - includes swagger-ui div', () => {
    const html = generateSwaggerHtml('/api/docs/openapi.json')

    assert.ok(html.includes('id="swagger-ui"'))
})

test('generateSwaggerHtml - includes initialization script', () => {
    const html = generateSwaggerHtml('/api/docs/openapi.json')

    assert.ok(html.includes('SwaggerUIBundle'))
    assert.ok(html.includes('window.onload'))
})

test('generateSwaggerHtml - enables try it out', () => {
    const html = generateSwaggerHtml('/api/docs/openapi.json')

    assert.ok(html.includes('tryItOutEnabled: true'))
})

test('generateSwaggerHtml - enables deep linking', () => {
    const html = generateSwaggerHtml('/api/docs/openapi.json')

    assert.ok(html.includes('deepLinking: true'))
})

test('generateSwaggerHtml - hides topbar', () => {
    const html = generateSwaggerHtml('/api/docs/openapi.json')

    assert.ok(html.includes('.topbar { display: none'))
})

test('generateSwaggerHtml - sets supported methods', () => {
    const html = generateSwaggerHtml('/api/docs/openapi.json')

    assert.ok(html.includes('supportedSubmitMethods'))
    assert.ok(html.includes('get'))
    assert.ok(html.includes('post'))
    assert.ok(html.includes('put'))
    assert.ok(html.includes('delete'))
})

// ============ Schema Validation Tests ============

test('openApiSpec - CreateBot tenantId has pattern', () => {
    const schema = openApiSpec.components.schemas.CreateBot
    assert.ok(schema.properties.tenantId.pattern)
})

test('openApiSpec - CreateBot tenantId has maxLength', () => {
    const schema = openApiSpec.components.schemas.CreateBot
    assert.ok(schema.properties.tenantId.maxLength)
    assert.is(schema.properties.tenantId.maxLength, 50)
})

test('openApiSpec - CreateBot flowIds has minItems', () => {
    const schema = openApiSpec.components.schemas.CreateBot
    assert.is(schema.properties.flowIds.minItems, 1)
})

test('openApiSpec - CreateBot port has valid range', () => {
    const schema = openApiSpec.components.schemas.CreateBot
    assert.is(schema.properties.port.minimum, 1024)
    assert.is(schema.properties.port.maximum, 65535)
})

test('openApiSpec - FlowStep answer has maxLength', () => {
    const schema = openApiSpec.components.schemas.FlowStep
    assert.ok(schema.properties.answer.maxLength)
    assert.is(schema.properties.answer.maxLength, 4096)
})

test('openApiSpec - FlowStep delay has valid range', () => {
    const schema = openApiSpec.components.schemas.FlowStep
    assert.is(schema.properties.delay.minimum, 0)
    assert.is(schema.properties.delay.maximum, 30000)
})

test('openApiSpec - FlowStep media is URL format', () => {
    const schema = openApiSpec.components.schemas.FlowStep
    assert.is(schema.properties.media.format, 'uri')
})

// ============ Tag Assignment Tests ============

test('openApiSpec - health endpoint is tagged correctly', () => {
    const tags = openApiSpec.paths['/health'].get.tags
    assert.ok(tags.includes('Health'))
})

test('openApiSpec - flow endpoints are tagged correctly', () => {
    const flowsGetTags = openApiSpec.paths['/flows'].get.tags
    const flowsPostTags = openApiSpec.paths['/flows'].post.tags

    assert.ok(flowsGetTags.includes('Flows'))
    assert.ok(flowsPostTags.includes('Flows'))
})

test('openApiSpec - bot endpoints are tagged correctly', () => {
    const botsGetTags = openApiSpec.paths['/bots'].get.tags
    const botsPostTags = openApiSpec.paths['/bots'].post.tags

    assert.ok(botsGetTags.includes('Bots'))
    assert.ok(botsPostTags.includes('Bots'))
})

// ============ Completeness Tests ============

test('openApiSpec - all endpoints have summaries', () => {
    const paths = Object.values(openApiSpec.paths)

    for (const path of paths) {
        const operations = Object.values(path as any)
        for (const op of operations) {
            assert.ok((op as any).summary, 'All endpoints should have summaries')
        }
    }
})

test('openApiSpec - all endpoints have responses', () => {
    const paths = Object.values(openApiSpec.paths)

    for (const path of paths) {
        const operations = Object.values(path as any)
        for (const op of operations) {
            assert.ok((op as any).responses, 'All endpoints should have responses')
        }
    }
})

test('openApiSpec - all POST/PUT endpoints have request bodies', () => {
    const paths = openApiSpec.paths

    for (const [pathName, methods] of Object.entries(paths)) {
        const methodsObj = methods as any
        if (methodsObj.post && pathName !== '/bots/{tenantId}/stop' && pathName !== '/bots/{tenantId}/reconnect') {
            assert.ok(methodsObj.post.requestBody, `POST ${pathName} should have requestBody`)
        }
        if (methodsObj.put) {
            assert.ok(methodsObj.put.requestBody, `PUT ${pathName} should have requestBody`)
        }
    }
})

test.run()
