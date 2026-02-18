import { test } from 'uvu'
import * as assert from 'uvu/assert'

import {
    createBotSchema,
    updateBotSchema,
    sendMessageSchema,
    restartBotSchema,
    createFlowSchema,
    updateFlowSchema,
    validate,
} from '../src/schemas'

// ============ createBotSchema Tests ============

test('createBotSchema - valid input', () => {
    const input = {
        tenantId: 'my-bot-123',
        name: 'My Bot',
        flowIds: ['greeting', 'support'],
        port: 3000,
    }
    const result = validate(createBotSchema, input)
    assert.ok(result.success)
    assert.equal(result.data?.tenantId, 'my-bot-123')
})

test('createBotSchema - minimal valid input', () => {
    const input = {
        tenantId: 'bot1',
        flowIds: ['flow1'],
    }
    const result = validate(createBotSchema, input)
    assert.ok(result.success)
})

test('createBotSchema - rejects reserved tenantId "active"', () => {
    const input = {
        tenantId: 'active',
        flowIds: ['flow1'],
    }
    const result = validate(createBotSchema, input)
    assert.not.ok(result.success)
    assert.ok(result.error?.includes('reserved') || result.error?.includes('tenantId'))
})

test('createBotSchema - rejects reserved tenantId "health"', () => {
    const input = {
        tenantId: 'health',
        flowIds: ['flow1'],
    }
    const result = validate(createBotSchema, input)
    assert.not.ok(result.success)
})

test('createBotSchema - rejects empty tenantId', () => {
    const input = {
        tenantId: '',
        flowIds: ['flow1'],
    }
    const result = validate(createBotSchema, input)
    assert.not.ok(result.success)
})

test('createBotSchema - rejects invalid tenantId characters', () => {
    const input = {
        tenantId: 'my bot!@#',
        flowIds: ['flow1'],
    }
    const result = validate(createBotSchema, input)
    assert.not.ok(result.success)
})

test('createBotSchema - rejects empty flowIds array', () => {
    const input = {
        tenantId: 'bot1',
        flowIds: [],
    }
    const result = validate(createBotSchema, input)
    assert.not.ok(result.success)
})

test('createBotSchema - rejects port below 1024', () => {
    const input = {
        tenantId: 'bot1',
        flowIds: ['flow1'],
        port: 80,
    }
    const result = validate(createBotSchema, input)
    assert.not.ok(result.success)
})

test('createBotSchema - rejects port above 65535', () => {
    const input = {
        tenantId: 'bot1',
        flowIds: ['flow1'],
        port: 70000,
    }
    const result = validate(createBotSchema, input)
    assert.not.ok(result.success)
})

// ============ updateBotSchema Tests ============

test('updateBotSchema - valid name update', () => {
    const input = { name: 'New Bot Name' }
    const result = validate(updateBotSchema, input)
    assert.ok(result.success)
})

test('updateBotSchema - empty object is valid', () => {
    const result = validate(updateBotSchema, {})
    assert.ok(result.success)
})

test('updateBotSchema - rejects empty name', () => {
    const input = { name: '' }
    const result = validate(updateBotSchema, input)
    assert.not.ok(result.success)
})

// ============ sendMessageSchema Tests ============

test('sendMessageSchema - valid message', () => {
    const input = {
        number: '1234567890',
        message: 'Hello world!',
    }
    const result = validate(sendMessageSchema, input)
    assert.ok(result.success)
})

test('sendMessageSchema - valid with media', () => {
    const input = {
        number: '+1234567890',
        message: 'Check this image',
        media: 'https://example.com/image.jpg',
    }
    const result = validate(sendMessageSchema, input)
    assert.ok(result.success)
})

test('sendMessageSchema - rejects short number', () => {
    const input = {
        number: '123',
        message: 'Hello',
    }
    const result = validate(sendMessageSchema, input)
    assert.not.ok(result.success)
})

test('sendMessageSchema - rejects invalid number characters', () => {
    const input = {
        number: '123-456-7890',
        message: 'Hello',
    }
    const result = validate(sendMessageSchema, input)
    assert.not.ok(result.success)
})

test('sendMessageSchema - rejects empty message', () => {
    const input = {
        number: '1234567890',
        message: '',
    }
    const result = validate(sendMessageSchema, input)
    assert.not.ok(result.success)
})

test('sendMessageSchema - rejects invalid media URL', () => {
    const input = {
        number: '1234567890',
        message: 'Hello',
        media: 'not-a-url',
    }
    const result = validate(sendMessageSchema, input)
    assert.not.ok(result.success)
})

// ============ restartBotSchema Tests ============

test('restartBotSchema - valid restart', () => {
    const input = {
        flowIds: ['flow1', 'flow2'],
        port: 3001,
        name: 'Restarted Bot',
    }
    const result = validate(restartBotSchema, input)
    assert.ok(result.success)
})

test('restartBotSchema - minimal valid', () => {
    const input = {
        flowIds: ['flow1'],
    }
    const result = validate(restartBotSchema, input)
    assert.ok(result.success)
})

test('restartBotSchema - rejects empty flowIds', () => {
    const input = {
        flowIds: [],
    }
    const result = validate(restartBotSchema, input)
    assert.not.ok(result.success)
})

// ============ createFlowSchema Tests ============

test('createFlowSchema - valid flow with string keyword', () => {
    const input = {
        id: 'greeting',
        name: 'Greeting Flow',
        keyword: 'hola',
        steps: [{ answer: 'Hola! Bienvenido' }],
    }
    const result = validate(createFlowSchema, input)
    assert.ok(result.success)
})

test('createFlowSchema - valid flow with array keywords', () => {
    const input = {
        id: 'greeting',
        name: 'Greeting Flow',
        keyword: ['hola', 'hello', 'hi'],
        steps: [
            { answer: 'Hello!', delay: 500 },
            { answer: 'How can I help?', capture: true },
        ],
    }
    const result = validate(createFlowSchema, input)
    assert.ok(result.success)
})

test('createFlowSchema - valid flow with media step', () => {
    const input = {
        id: 'media-flow',
        name: 'Media Flow',
        keyword: 'image',
        steps: [{ answer: 'Here is an image', media: 'https://example.com/image.jpg' }],
    }
    const result = validate(createFlowSchema, input)
    assert.ok(result.success)
})

test('createFlowSchema - rejects reserved id "active"', () => {
    const input = {
        id: 'active',
        name: 'Flow',
        keyword: 'test',
        steps: [{ answer: 'test' }],
    }
    const result = validate(createFlowSchema, input)
    assert.not.ok(result.success)
})

test('createFlowSchema - rejects empty steps', () => {
    const input = {
        id: 'flow1',
        name: 'Flow',
        keyword: 'test',
        steps: [],
    }
    const result = validate(createFlowSchema, input)
    assert.not.ok(result.success)
})

test('createFlowSchema - rejects step with empty answer', () => {
    const input = {
        id: 'flow1',
        name: 'Flow',
        keyword: 'test',
        steps: [{ answer: '' }],
    }
    const result = validate(createFlowSchema, input)
    assert.not.ok(result.success)
})

test('createFlowSchema - rejects delay over 30000ms', () => {
    const input = {
        id: 'flow1',
        name: 'Flow',
        keyword: 'test',
        steps: [{ answer: 'test', delay: 60000 }],
    }
    const result = validate(createFlowSchema, input)
    assert.not.ok(result.success)
})

// ============ updateFlowSchema Tests ============

test('updateFlowSchema - valid partial update', () => {
    const input = {
        name: 'Updated Flow Name',
    }
    const result = validate(updateFlowSchema, input)
    assert.ok(result.success)
})

test('updateFlowSchema - valid keyword update', () => {
    const input = {
        keyword: ['new', 'keywords'],
    }
    const result = validate(updateFlowSchema, input)
    assert.ok(result.success)
})

test('updateFlowSchema - valid steps update', () => {
    const input = {
        steps: [{ answer: 'New answer' }],
    }
    const result = validate(updateFlowSchema, input)
    assert.ok(result.success)
})

test('updateFlowSchema - empty object is valid', () => {
    const result = validate(updateFlowSchema, {})
    assert.ok(result.success)
})

// ============ validate function Tests ============

test('validate - returns success true for valid data', () => {
    const result = validate(updateBotSchema, { name: 'Test' })
    assert.ok(result.success)
    assert.ok(result.data)
    assert.not.ok(result.error)
})

test('validate - returns success false with errors for invalid data', () => {
    const result = validate(createBotSchema, { tenantId: '' })
    assert.not.ok(result.success)
    assert.ok(result.error)
    assert.ok(result.errors)
    assert.ok(result.errors!.length > 0)
})

test('validate - error contains field information', () => {
    const result = validate(createBotSchema, { tenantId: '', flowIds: [] })
    assert.not.ok(result.success)
    const fields = result.errors?.map((e) => e.field)
    assert.ok(fields?.includes('tenantId'))
})

test.run()
