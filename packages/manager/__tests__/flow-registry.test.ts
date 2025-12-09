import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { FlowRegistry, type FlowDefinition } from '../src/flow-registry'
import type { CreateFlowInput } from '../src/schemas'

// Mock flow for testing
const createMockFlow = () => ({ addAnswer: () => {} } as any)

// ============ Constructor Tests ============

test('FlowRegistry - constructor creates empty registry', () => {
    const registry = new FlowRegistry()
    assert.is(registry.count(), 0)
    assert.equal(registry.getAll(), [])
    assert.equal(registry.getIds(), [])
})

// ============ register() Tests ============

test('FlowRegistry - register adds programmatic flow', () => {
    const registry = new FlowRegistry()
    const mockFlow = createMockFlow()

    const result = registry.register('test-flow', 'Test Flow', mockFlow)

    assert.is(result.id, 'test-flow')
    assert.is(result.name, 'Test Flow')
    assert.is(result.flow, mockFlow)
    assert.is(result.dynamic, false)
    assert.ok(result.createdAt instanceof Date)
    assert.ok(result.updatedAt instanceof Date)
})

test('FlowRegistry - register increases count', () => {
    const registry = new FlowRegistry()

    registry.register('flow1', 'Flow 1', createMockFlow())
    assert.is(registry.count(), 1)

    registry.register('flow2', 'Flow 2', createMockFlow())
    assert.is(registry.count(), 2)
})

test('FlowRegistry - register overwrites existing flow with same ID', () => {
    const registry = new FlowRegistry()
    const flow1 = createMockFlow()
    const flow2 = createMockFlow()

    registry.register('same-id', 'First', flow1)
    registry.register('same-id', 'Second', flow2)

    assert.is(registry.count(), 1)
    const flow = registry.get('same-id')
    assert.is(flow?.name, 'Second')
    assert.is(flow?.flow, flow2)
})

// ============ registerDynamic() Tests ============

test('FlowRegistry - registerDynamic creates dynamic flow with string keyword', () => {
    const registry = new FlowRegistry()
    const config: CreateFlowInput = {
        id: 'greeting',
        name: 'Greeting Flow',
        keyword: 'hello',
        steps: [{ answer: 'Hello!' }],
    }

    const result = registry.registerDynamic(config)

    assert.is(result.id, 'greeting')
    assert.is(result.name, 'Greeting Flow')
    assert.is(result.dynamic, true)
    assert.equal(result.config, config)
    assert.ok(result.flow)
})

test('FlowRegistry - registerDynamic creates dynamic flow with array keywords', () => {
    const registry = new FlowRegistry()
    const config: CreateFlowInput = {
        id: 'multi-keyword',
        name: 'Multi Keyword Flow',
        keyword: ['hi', 'hello', 'hey'],
        steps: [{ answer: 'Greetings!' }],
    }

    const result = registry.registerDynamic(config)

    assert.is(result.id, 'multi-keyword')
    assert.is(result.dynamic, true)
    assert.ok(result.config)
})

test('FlowRegistry - registerDynamic creates flow with multiple steps', () => {
    const registry = new FlowRegistry()
    const config: CreateFlowInput = {
        id: 'multi-step',
        name: 'Multi Step Flow',
        keyword: 'start',
        steps: [{ answer: 'Step 1' }, { answer: 'Step 2', delay: 1000 }, { answer: 'Step 3', capture: true }],
    }

    const result = registry.registerDynamic(config)

    assert.is(result.id, 'multi-step')
    assert.is(result.config?.steps.length, 3)
})

test('FlowRegistry - registerDynamic creates flow with step options', () => {
    const registry = new FlowRegistry()
    const config: CreateFlowInput = {
        id: 'options-flow',
        name: 'Options Flow',
        keyword: 'test',
        steps: [
            {
                answer: 'With options',
                delay: 500,
                media: 'https://example.com/image.jpg',
                capture: true,
            },
        ],
    }

    const result = registry.registerDynamic(config)

    assert.is(result.dynamic, true)
    assert.is(result.config?.steps[0].delay, 500)
    assert.is(result.config?.steps[0].media, 'https://example.com/image.jpg')
    assert.is(result.config?.steps[0].capture, true)
})

// ============ update() Tests ============

test('FlowRegistry - update modifies dynamic flow name', () => {
    const registry = new FlowRegistry()
    const config: CreateFlowInput = {
        id: 'updateable',
        name: 'Original Name',
        keyword: 'test',
        steps: [{ answer: 'Hello' }],
    }
    registry.registerDynamic(config)

    const result = registry.update('updateable', { name: 'Updated Name' })

    assert.ok(result)
    assert.is(result?.name, 'Updated Name')
    assert.is(result?.dynamic, true)
})

test('FlowRegistry - update modifies dynamic flow keyword', () => {
    const registry = new FlowRegistry()
    registry.registerDynamic({
        id: 'keyword-update',
        name: 'Test',
        keyword: 'old',
        steps: [{ answer: 'Test' }],
    })

    const result = registry.update('keyword-update', { keyword: 'new' })

    assert.ok(result)
    assert.is(result?.config?.keyword, 'new')
})

test('FlowRegistry - update modifies dynamic flow steps', () => {
    const registry = new FlowRegistry()
    registry.registerDynamic({
        id: 'steps-update',
        name: 'Test',
        keyword: 'test',
        steps: [{ answer: 'Old answer' }],
    })

    const result = registry.update('steps-update', {
        steps: [{ answer: 'New answer' }, { answer: 'Another step' }],
    })

    assert.ok(result)
    assert.is(result?.config?.steps.length, 2)
    assert.is(result?.config?.steps[0].answer, 'New answer')
})

test('FlowRegistry - update returns null for non-existent flow', () => {
    const registry = new FlowRegistry()

    const result = registry.update('non-existent', { name: 'Test' })

    assert.is(result, null)
})

test('FlowRegistry - update returns null for programmatic flow', () => {
    const registry = new FlowRegistry()
    registry.register('programmatic', 'Programmatic Flow', createMockFlow())

    const result = registry.update('programmatic', { name: 'Updated' })

    assert.is(result, null)
})

test('FlowRegistry - update preserves createdAt timestamp', () => {
    const registry = new FlowRegistry()
    const original = registry.registerDynamic({
        id: 'preserve-created',
        name: 'Test',
        keyword: 'test',
        steps: [{ answer: 'Test' }],
    })

    const originalCreatedAt = original.createdAt

    // Small delay to ensure different timestamps
    const result = registry.update('preserve-created', { name: 'Updated' })

    assert.is(result?.createdAt.getTime(), originalCreatedAt.getTime())
})

test('FlowRegistry - update changes updatedAt timestamp', () => {
    const registry = new FlowRegistry()
    const original = registry.registerDynamic({
        id: 'update-timestamp',
        name: 'Test',
        keyword: 'test',
        steps: [{ answer: 'Test' }],
    })

    const originalUpdatedAt = original.updatedAt.getTime()

    // Small delay
    const result = registry.update('update-timestamp', { name: 'Updated' })

    assert.ok(result!.updatedAt.getTime() >= originalUpdatedAt)
})

// ============ remove() Tests ============

test('FlowRegistry - remove deletes flow', () => {
    const registry = new FlowRegistry()
    registry.register('to-remove', 'To Remove', createMockFlow())

    assert.is(registry.count(), 1)

    const result = registry.remove('to-remove')

    assert.is(result, true)
    assert.is(registry.count(), 0)
    assert.is(registry.get('to-remove'), undefined)
})

test('FlowRegistry - remove returns false for non-existent flow', () => {
    const registry = new FlowRegistry()

    const result = registry.remove('non-existent')

    assert.is(result, false)
})

test('FlowRegistry - remove works for both dynamic and programmatic flows', () => {
    const registry = new FlowRegistry()
    registry.register('programmatic', 'Programmatic', createMockFlow())
    registry.registerDynamic({
        id: 'dynamic',
        name: 'Dynamic',
        keyword: 'test',
        steps: [{ answer: 'Test' }],
    })

    assert.is(registry.remove('programmatic'), true)
    assert.is(registry.remove('dynamic'), true)
    assert.is(registry.count(), 0)
})

// ============ get() Tests ============

test('FlowRegistry - get returns flow definition', () => {
    const registry = new FlowRegistry()
    const mockFlow = createMockFlow()
    registry.register('get-test', 'Get Test', mockFlow)

    const result = registry.get('get-test')

    assert.ok(result)
    assert.is(result?.id, 'get-test')
    assert.is(result?.name, 'Get Test')
    assert.is(result?.flow, mockFlow)
})

test('FlowRegistry - get returns undefined for non-existent flow', () => {
    const registry = new FlowRegistry()

    const result = registry.get('non-existent')

    assert.is(result, undefined)
})

// ============ getAll() Tests ============

test('FlowRegistry - getAll returns empty array when empty', () => {
    const registry = new FlowRegistry()

    const result = registry.getAll()

    assert.equal(result, [])
})

test('FlowRegistry - getAll returns all flows', () => {
    const registry = new FlowRegistry()
    registry.register('flow1', 'Flow 1', createMockFlow())
    registry.register('flow2', 'Flow 2', createMockFlow())
    registry.registerDynamic({
        id: 'flow3',
        name: 'Flow 3',
        keyword: 'test',
        steps: [{ answer: 'Test' }],
    })

    const result = registry.getAll()

    assert.is(result.length, 3)
})

test('FlowRegistry - getAll returns copies (not references)', () => {
    const registry = new FlowRegistry()
    registry.register('flow1', 'Flow 1', createMockFlow())

    const result1 = registry.getAll()
    const result2 = registry.getAll()

    assert.is.not(result1, result2)
})

// ============ has() Tests ============

test('FlowRegistry - has returns true for existing flow', () => {
    const registry = new FlowRegistry()
    registry.register('exists', 'Exists', createMockFlow())

    assert.is(registry.has('exists'), true)
})

test('FlowRegistry - has returns false for non-existent flow', () => {
    const registry = new FlowRegistry()

    assert.is(registry.has('non-existent'), false)
})

// ============ getIds() Tests ============

test('FlowRegistry - getIds returns empty array when empty', () => {
    const registry = new FlowRegistry()

    assert.equal(registry.getIds(), [])
})

test('FlowRegistry - getIds returns all flow IDs', () => {
    const registry = new FlowRegistry()
    registry.register('id1', 'Flow 1', createMockFlow())
    registry.register('id2', 'Flow 2', createMockFlow())

    const ids = registry.getIds()

    assert.ok(ids.includes('id1'))
    assert.ok(ids.includes('id2'))
    assert.is(ids.length, 2)
})

// ============ count() Tests ============

test('FlowRegistry - count returns 0 when empty', () => {
    const registry = new FlowRegistry()

    assert.is(registry.count(), 0)
})

test('FlowRegistry - count returns correct number', () => {
    const registry = new FlowRegistry()
    registry.register('flow1', 'Flow 1', createMockFlow())
    registry.register('flow2', 'Flow 2', createMockFlow())

    assert.is(registry.count(), 2)
})

// ============ clear() Tests ============

test('FlowRegistry - clear removes all flows', () => {
    const registry = new FlowRegistry()
    registry.register('flow1', 'Flow 1', createMockFlow())
    registry.register('flow2', 'Flow 2', createMockFlow())

    registry.clear()

    assert.is(registry.count(), 0)
    assert.equal(registry.getAll(), [])
})

test('FlowRegistry - clear on empty registry does nothing', () => {
    const registry = new FlowRegistry()

    registry.clear()

    assert.is(registry.count(), 0)
})

// ============ getByType() Tests ============

test('FlowRegistry - getByType returns only dynamic flows', () => {
    const registry = new FlowRegistry()
    registry.register('programmatic', 'Programmatic', createMockFlow())
    registry.registerDynamic({
        id: 'dynamic',
        name: 'Dynamic',
        keyword: 'test',
        steps: [{ answer: 'Test' }],
    })

    const dynamicFlows = registry.getByType(true)

    assert.is(dynamicFlows.length, 1)
    assert.is(dynamicFlows[0].id, 'dynamic')
    assert.is(dynamicFlows[0].dynamic, true)
})

test('FlowRegistry - getByType returns only programmatic flows', () => {
    const registry = new FlowRegistry()
    registry.register('programmatic', 'Programmatic', createMockFlow())
    registry.registerDynamic({
        id: 'dynamic',
        name: 'Dynamic',
        keyword: 'test',
        steps: [{ answer: 'Test' }],
    })

    const programmaticFlows = registry.getByType(false)

    assert.is(programmaticFlows.length, 1)
    assert.is(programmaticFlows[0].id, 'programmatic')
    assert.is(programmaticFlows[0].dynamic, false)
})

test('FlowRegistry - getByType returns empty array when no matches', () => {
    const registry = new FlowRegistry()
    registry.register('programmatic', 'Programmatic', createMockFlow())

    const dynamicFlows = registry.getByType(true)

    assert.equal(dynamicFlows, [])
})

// ============ resolveFlows() Tests ============

test('FlowRegistry - resolveFlows returns flows for valid IDs', () => {
    const registry = new FlowRegistry()
    const flow1 = createMockFlow()
    const flow2 = createMockFlow()
    registry.register('flow1', 'Flow 1', flow1)
    registry.register('flow2', 'Flow 2', flow2)

    const result = registry.resolveFlows(['flow1', 'flow2'])

    assert.is(result.flows.length, 2)
    assert.ok(result.flows.includes(flow1))
    assert.ok(result.flows.includes(flow2))
    assert.equal(result.missing, [])
})

test('FlowRegistry - resolveFlows returns missing IDs', () => {
    const registry = new FlowRegistry()
    registry.register('flow1', 'Flow 1', createMockFlow())

    const result = registry.resolveFlows(['flow1', 'non-existent', 'also-missing'])

    assert.is(result.flows.length, 1)
    assert.is(result.missing.length, 2)
    assert.ok(result.missing.includes('non-existent'))
    assert.ok(result.missing.includes('also-missing'))
})

test('FlowRegistry - resolveFlows with empty array', () => {
    const registry = new FlowRegistry()

    const result = registry.resolveFlows([])

    assert.equal(result.flows, [])
    assert.equal(result.missing, [])
})

test('FlowRegistry - resolveFlows with all missing', () => {
    const registry = new FlowRegistry()

    const result = registry.resolveFlows(['missing1', 'missing2'])

    assert.equal(result.flows, [])
    assert.is(result.missing.length, 2)
})

// ============ exportDynamicFlows() Tests ============

test('FlowRegistry - exportDynamicFlows returns only dynamic flow configs', () => {
    const registry = new FlowRegistry()
    registry.register('programmatic', 'Programmatic', createMockFlow())

    const dynamicConfig: CreateFlowInput = {
        id: 'dynamic',
        name: 'Dynamic',
        keyword: 'test',
        steps: [{ answer: 'Test' }],
    }
    registry.registerDynamic(dynamicConfig)

    const exported = registry.exportDynamicFlows()

    assert.is(exported.length, 1)
    assert.equal(exported[0], dynamicConfig)
})

test('FlowRegistry - exportDynamicFlows returns empty array when no dynamic flows', () => {
    const registry = new FlowRegistry()
    registry.register('programmatic', 'Programmatic', createMockFlow())

    const exported = registry.exportDynamicFlows()

    assert.equal(exported, [])
})

test('FlowRegistry - exportDynamicFlows returns multiple configs', () => {
    const registry = new FlowRegistry()

    registry.registerDynamic({
        id: 'dynamic1',
        name: 'Dynamic 1',
        keyword: 'test1',
        steps: [{ answer: 'Test 1' }],
    })
    registry.registerDynamic({
        id: 'dynamic2',
        name: 'Dynamic 2',
        keyword: 'test2',
        steps: [{ answer: 'Test 2' }],
    })

    const exported = registry.exportDynamicFlows()

    assert.is(exported.length, 2)
})

// ============ importDynamicFlows() Tests ============

test('FlowRegistry - importDynamicFlows imports valid configs', () => {
    const registry = new FlowRegistry()
    const configs: CreateFlowInput[] = [
        {
            id: 'imported1',
            name: 'Imported 1',
            keyword: 'test1',
            steps: [{ answer: 'Test 1' }],
        },
        {
            id: 'imported2',
            name: 'Imported 2',
            keyword: 'test2',
            steps: [{ answer: 'Test 2' }],
        },
    ]

    const result = registry.importDynamicFlows(configs)

    assert.is(result.imported, 2)
    assert.equal(result.failed, [])
    assert.is(registry.count(), 2)
})

test('FlowRegistry - importDynamicFlows skips existing IDs', () => {
    const registry = new FlowRegistry()
    registry.registerDynamic({
        id: 'existing',
        name: 'Existing',
        keyword: 'existing',
        steps: [{ answer: 'Existing' }],
    })

    const configs: CreateFlowInput[] = [
        {
            id: 'existing', // Should be skipped
            name: 'New Existing',
            keyword: 'new',
            steps: [{ answer: 'New' }],
        },
        {
            id: 'new-flow',
            name: 'New Flow',
            keyword: 'new',
            steps: [{ answer: 'New' }],
        },
    ]

    const result = registry.importDynamicFlows(configs)

    assert.is(result.imported, 1)
    assert.is(registry.count(), 2)
    // Original should remain unchanged
    assert.is(registry.get('existing')?.name, 'Existing')
})

test('FlowRegistry - importDynamicFlows returns empty for empty array', () => {
    const registry = new FlowRegistry()

    const result = registry.importDynamicFlows([])

    assert.is(result.imported, 0)
    assert.equal(result.failed, [])
})

// ============ Edge Cases ============

test('FlowRegistry - handles special characters in ID', () => {
    const registry = new FlowRegistry()

    registry.register('flow-with-dash', 'Dash Flow', createMockFlow())
    registry.register('flow_with_underscore', 'Underscore Flow', createMockFlow())

    assert.ok(registry.has('flow-with-dash'))
    assert.ok(registry.has('flow_with_underscore'))
})

test('FlowRegistry - handles empty string names', () => {
    const registry = new FlowRegistry()

    registry.register('empty-name', '', createMockFlow())

    const flow = registry.get('empty-name')
    assert.is(flow?.name, '')
})

test('FlowRegistry - handles unicode in names', () => {
    const registry = new FlowRegistry()

    registry.register('unicode', '流れ Flow 🚀', createMockFlow())

    const flow = registry.get('unicode')
    assert.is(flow?.name, '流れ Flow 🚀')
})

test('FlowRegistry - dynamic flow with all step options', () => {
    const registry = new FlowRegistry()
    const config: CreateFlowInput = {
        id: 'full-options',
        name: 'Full Options',
        keyword: ['hello', 'hi'],
        steps: [
            { answer: 'First message' },
            { answer: 'With delay', delay: 1000 },
            { answer: 'With media', media: 'https://example.com/img.png' },
            { answer: 'With capture', capture: true },
            {
                answer: 'All options',
                delay: 500,
                media: 'https://example.com/video.mp4',
                capture: true,
            },
        ],
    }

    const result = registry.registerDynamic(config)

    assert.is(result.config?.steps.length, 5)
})

test.run()
