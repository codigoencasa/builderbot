import { test } from 'uvu'
import * as assert from 'uvu/assert'
import * as sinon from 'sinon'

import { CoreClass } from '../../src/core/coreClass'
import FlowClass from '../../src/io/flowClass'
import { addKeyword } from '../../src/io/methods'

/**
 * Helper to create mock dependencies for CoreClass
 */
const createMockDeps = (flows = [addKeyword('hello').addAnswer('Hi there!')]) => {
    const flowClass = new FlowClass(flows)

    const database = {
        getPrevByNumber: sinon.stub().resolves(null),
        save: sinon.stub().resolves(),
        listHistory: [],
    }

    const provider = {
        on: sinon.stub(),
        sendMessage: sinon.stub().resolves({ status: 'sent' }),
        initAll: sinon.stub(),
        inHandleCtx: sinon.stub(),
    }

    const args = {
        blackList: [],
        listEvents: {},
        delay: 0,
        globalState: {},
        extensions: undefined,
        queue: { timeout: 20000, concurrencyLimit: 15 },
    }

    return { flowClass, database, provider, args }
}

// ===== Constructor Tests =====

test('[CoreClass] should instantiate correctly', () => {
    const { flowClass, database, provider, args } = createMockDeps()
    const core = new CoreClass(flowClass, database as any, provider as any, args)
    assert.instance(core, CoreClass)
})

test('[CoreClass] should register event listeners on provider', () => {
    const { flowClass, database, provider, args } = createMockDeps()
    new CoreClass(flowClass, database as any, provider as any, args)
    assert.ok(provider.on.called, 'Provider.on should have been called')
    const eventNames = provider.on.getCalls().map((c: any) => c.args[0])
    assert.ok(eventNames.includes('message'), 'Should register message event')
    assert.ok(eventNames.includes('ready'), 'Should register ready event')
    assert.ok(eventNames.includes('require_action'), 'Should register require_action event')
    assert.ok(eventNames.includes('auth_failure'), 'Should register auth_failure event')
    assert.ok(eventNames.includes('notice'), 'Should register notice event')
    assert.ok(eventNames.includes('host'), 'Should register host event')
})

test('[CoreClass] should set blacklist from args', () => {
    const { flowClass, database, provider } = createMockDeps()
    const args = {
        blackList: ['123', '456'],
        listEvents: {},
        delay: 0,
        globalState: {},
        extensions: undefined,
        queue: { timeout: 20000, concurrencyLimit: 15 },
    }
    const core = new CoreClass(flowClass, database as any, provider as any, args)
    assert.ok(core.dynamicBlacklist.checkIf('123'), 'Number 123 should be blacklisted')
    assert.ok(core.dynamicBlacklist.checkIf('456'), 'Number 456 should be blacklisted')
    assert.not.ok(core.dynamicBlacklist.checkIf('789'), 'Number 789 should not be blacklisted')
})

test('[CoreClass] should initialize globalState from args', () => {
    const { flowClass, database, provider } = createMockDeps()
    const args = {
        blackList: [],
        listEvents: {},
        delay: 0,
        globalState: { counter: 0, name: 'test' },
        extensions: undefined,
        queue: { timeout: 20000, concurrencyLimit: 15 },
    }
    const core = new CoreClass(flowClass, database as any, provider as any, args)
    const stateIterator = core.globalStateHandler.getAllState()
    const stateValues = Array.from(stateIterator)
    const globalState = stateValues[0]
    assert.equal(globalState.counter, 0)
    assert.equal(globalState.name, 'test')
})

test('[CoreClass] should set extensions on globalStateHandler', () => {
    const { flowClass, database, provider } = createMockDeps()
    const mockExtensions = { myPlugin: { execute: () => 'ok' } }
    const args = {
        blackList: [],
        listEvents: {},
        delay: 0,
        globalState: {},
        extensions: mockExtensions as any,
        queue: { timeout: 20000, concurrencyLimit: 15 },
    }
    const core = new CoreClass(flowClass, database as any, provider as any, args)
    assert.equal(core.globalStateHandler.RAW, mockExtensions)
})

test('[CoreClass] should initialize queue with correct concurrency', () => {
    const { flowClass, database, provider } = createMockDeps()
    const args = {
        blackList: [],
        listEvents: {},
        delay: 0,
        globalState: {},
        extensions: undefined,
        queue: { timeout: 5000, concurrencyLimit: 5 },
    }
    const core = new CoreClass(flowClass, database as any, provider as any, args)
    assert.ok(core.queuePrincipal, 'Queue should be initialized')
})

// ===== handleMsg Tests =====

test('[CoreClass] handleMsg should skip blacklisted numbers', async () => {
    const { flowClass, database, provider } = createMockDeps()
    const args = {
        blackList: ['blacklisted_user'],
        listEvents: {},
        delay: 0,
        globalState: {},
        extensions: undefined,
        queue: { timeout: 20000, concurrencyLimit: 15 },
    }
    const core = new CoreClass(flowClass, database as any, provider as any, args)

    const result = await core.handleMsg({
        body: 'hello',
        from: 'blacklisted_user',
        name: 'Test',
        host: '',
    } as any)

    assert.not.ok(result, 'Should return early for blacklisted users')
    assert.not.ok(database.getPrevByNumber.called, 'Should not query database for blacklisted users')
})

test('[CoreClass] handleMsg should skip empty body messages', async () => {
    const { flowClass, database, provider, args } = createMockDeps()
    const core = new CoreClass(flowClass, database as any, provider as any, args)

    const result = await core.handleMsg({
        body: '',
        from: 'user123',
        name: 'Test',
        host: '',
    } as any)

    assert.not.ok(result, 'Should return early for empty body')
})

test('[CoreClass] handleMsg should skip null body messages', async () => {
    const { flowClass, database, provider, args } = createMockDeps()
    const core = new CoreClass(flowClass, database as any, provider as any, args)

    const result = await core.handleMsg({
        body: null,
        from: 'user123',
        name: 'Test',
        host: '',
    } as any)

    assert.not.ok(result, 'Should return early for null body')
})

test('[CoreClass] handleMsg should query database for previous messages', async () => {
    const { flowClass, database, provider, args } = createMockDeps()
    const core = new CoreClass(flowClass, database as any, provider as any, args)

    await core.handleMsg({
        body: 'hello',
        from: 'user123',
        name: 'Test',
        host: '',
    } as any)

    assert.ok(database.getPrevByNumber.calledWith('user123'), 'Should query prev by number')
})

test('[CoreClass] handleMsg should match keyword and return flow functions', async () => {
    const { flowClass, database, provider, args } = createMockDeps()
    const core = new CoreClass(flowClass, database as any, provider as any, args)

    const result = await core.handleMsg({
        body: 'hello',
        from: 'user123',
        name: 'Test',
        host: '',
    } as any)

    assert.ok(result, 'Should return result for matching keyword')
    assert.type(result.endFlow, 'function')
    assert.type(result.fallBack, 'function')
    assert.type(result.gotoFlow, 'function')
    assert.type(result.flowDynamic, 'function')
    assert.type(result.sendFlow, 'function')
    assert.type(result.continueFlow, 'function')
})

test('[CoreClass] handleMsg should handle non-matching messages with WELCOME event', async () => {
    const WELCOME_FLOW = addKeyword('__event_welcome__').addAnswer('Welcome!')
    const { database, provider } = createMockDeps()
    const flowClass = new FlowClass([WELCOME_FLOW])
    const args = {
        blackList: [],
        listEvents: { WELCOME: '__event_welcome__' },
        delay: 0,
        globalState: {},
        extensions: undefined,
        queue: { timeout: 20000, concurrencyLimit: 15 },
    }
    const core = new CoreClass(flowClass, database as any, provider as any, args)

    const result = await core.handleMsg({
        body: 'unmatched_message_xyz',
        from: 'user123',
        name: 'Test',
        host: '',
    } as any)

    assert.ok(result, 'Should return result even for non-matching messages')
})

// ===== sendProviderAndSave Tests =====

test('[CoreClass] sendProviderAndSave should send message via provider', async () => {
    const { flowClass, database, provider, args } = createMockDeps()
    const core = new CoreClass(flowClass, database as any, provider as any, args)

    await core.sendProviderAndSave('user123', {
        ref: 'ref1',
        keyword: 'hello',
        answer: 'Hi there!',
        options: {},
        from: 'user123',
        refSerialize: 'ser1',
    })

    assert.ok(provider.sendMessage.called, 'Provider sendMessage should be called')
    assert.ok(database.save.called, 'Database save should be called')
})

test('[CoreClass] sendProviderAndSave should skip internal answers', async () => {
    const { flowClass, database, provider, args } = createMockDeps()
    const core = new CoreClass(flowClass, database as any, provider as any, args)

    const internalAnswers = ['__call_action__', '__goto_flow__', '__end_flow__']

    for (const answer of internalAnswers) {
        provider.sendMessage.resetHistory()
        await core.sendProviderAndSave('user123', {
            ref: 'ref1',
            keyword: 'hello',
            answer,
            options: {},
            from: 'user123',
            refSerialize: 'ser1',
        })
        assert.not.ok(
            provider.sendMessage.called,
            `Provider sendMessage should NOT be called for "${answer}"`
        )
    }
})

test('[CoreClass] sendProviderAndSave should skip __capture_only_intended__ answer', async () => {
    const { flowClass, database, provider, args } = createMockDeps()
    const core = new CoreClass(flowClass, database as any, provider as any, args)

    await core.sendProviderAndSave('user123', {
        ref: 'ref1',
        keyword: 'hello',
        answer: '__capture_only_intended__',
        options: {},
        from: 'user123',
        refSerialize: 'ser1',
    })

    assert.not.ok(provider.sendMessage.called, 'Should not send __capture_only_intended__')
    assert.ok(database.save.called, 'Should still save to database')
})

test('[CoreClass] sendProviderAndSave should still save to database for internal answers', async () => {
    const { flowClass, database, provider, args } = createMockDeps()
    const core = new CoreClass(flowClass, database as any, provider as any, args)

    await core.sendProviderAndSave('user123', {
        ref: 'ref1',
        keyword: 'hello',
        answer: '__end_flow__',
        options: {},
        from: 'user123',
        refSerialize: 'ser1',
    })

    assert.ok(database.save.called, 'Database save should be called even for internal answers')
})

test('[CoreClass] sendProviderAndSave should handle empty answer', async () => {
    const { flowClass, database, provider, args } = createMockDeps()
    const core = new CoreClass(flowClass, database as any, provider as any, args)

    await core.sendProviderAndSave('user123', {
        ref: 'ref1',
        keyword: 'hello',
        answer: '',
        options: {},
        from: 'user123',
        refSerialize: 'ser1',
    })

    assert.not.ok(provider.sendMessage.called, 'Should not send empty answer')
    assert.ok(database.save.called, 'Should still save to database')
})

test('[CoreClass] sendProviderAndSave should reject on provider error', async () => {
    const { flowClass, database, provider, args } = createMockDeps()
    provider.sendMessage = sinon.stub().rejects(new Error('Network error'))
    const core = new CoreClass(flowClass, database as any, provider as any, args)

    try {
        await core.sendProviderAndSave('user123', {
            ref: 'ref1',
            keyword: 'hello',
            answer: 'Hi',
            options: {},
            from: 'user123',
            refSerialize: 'ser1',
        })
        assert.unreachable('Should have thrown')
    } catch (err) {
        assert.instance(err, Error)
    }
})

test('[CoreClass] sendProviderAndSave should emit send_message event', async () => {
    const { flowClass, database, provider, args } = createMockDeps()
    const core = new CoreClass(flowClass, database as any, provider as any, args)
    const emitSpy = sinon.spy(core, 'emit')

    await core.sendProviderAndSave('user123', {
        ref: 'ref1',
        keyword: 'hello',
        answer: 'Hi there!',
        options: {},
        from: 'user123',
        refSerialize: 'ser1',
    })

    assert.ok(emitSpy.calledWith('send_message'), 'Should emit send_message event')
    emitSpy.restore()
})

// ===== sendFlowSimple Tests =====

test('[CoreClass] sendFlowSimple should process array of messages', async () => {
    const { flowClass, database, provider, args } = createMockDeps()
    const core = new CoreClass(flowClass, database as any, provider as any, args)

    const messages = [
        { ref: 'r1', answer: 'Msg 1', options: { delay: 0 }, keyword: 'k', from: 'u', refSerialize: 's1' },
        { ref: 'r2', answer: 'Msg 2', options: { delay: 0 }, keyword: 'k', from: 'u', refSerialize: 's2' },
    ]

    await core.sendFlowSimple(messages, 'user123')

    assert.ok(provider.sendMessage.called, 'Provider sendMessage should be called')
})

// ===== listenerBusEvents Tests =====

test('[CoreClass] listenerBusEvents should return correct event handlers', () => {
    const { flowClass, database, provider, args } = createMockDeps()
    const core = new CoreClass(flowClass, database as any, provider as any, args)
    const events = core.listenerBusEvents()

    assert.equal(events.length, 6, 'Should have 6 event handlers')

    const eventNames = events.map((e) => e.event)
    assert.ok(eventNames.includes('require_action'))
    assert.ok(eventNames.includes('notice'))
    assert.ok(eventNames.includes('ready'))
    assert.ok(eventNames.includes('auth_failure'))
    assert.ok(eventNames.includes('message'))
    assert.ok(eventNames.includes('host'))
})

// ===== httpServer Tests =====

test('[CoreClass] httpServer should call provider.initAll', () => {
    const { flowClass, database, provider, args } = createMockDeps()
    const core = new CoreClass(flowClass, database as any, provider as any, args)

    core.httpServer(3000)

    assert.ok(provider.initAll.called, 'Provider initAll should be called')
    assert.equal(provider.initAll.firstCall.args[0], 3000, 'Should pass port 3000')
})

// ===== handleCtx Tests =====

test('[CoreClass] handleCtx should delegate to provider.inHandleCtx', () => {
    const { flowClass, database, provider, args } = createMockDeps()
    const core = new CoreClass(flowClass, database as any, provider as any, args)
    const callback = async () => {}

    core.handleCtx(callback)

    assert.ok(provider.inHandleCtx.called, 'Provider inHandleCtx should be called')
})

// ===== Multiple flows matching =====

test('[CoreClass] handleMsg should match first flow for a keyword', async () => {
    const flow1 = addKeyword('greet').addAnswer('Hello from flow1!')
    const flow2 = addKeyword('goodbye').addAnswer('Bye!')
    const { database, provider } = createMockDeps()
    const flowClass = new FlowClass([flow1, flow2])
    const args = {
        blackList: [],
        listEvents: {},
        delay: 0,
        globalState: {},
        extensions: undefined,
        queue: { timeout: 20000, concurrencyLimit: 15 },
    }
    const core = new CoreClass(flowClass, database as any, provider as any, args)

    const result = await core.handleMsg({
        body: 'greet',
        from: 'user123',
        name: 'Test',
        host: '',
    } as any)

    assert.ok(result, 'Should match greet flow')
})

// ===== State handler =====

test('[CoreClass] stateHandler should be isolated per user', async () => {
    const { flowClass, database, provider, args } = createMockDeps()
    const core = new CoreClass(flowClass, database as any, provider as any, args)

    await core.stateHandler.updateState({ from: 'user1' })({ name: 'Alice' })
    await core.stateHandler.updateState({ from: 'user2' })({ name: 'Bob' })

    const state1 = core.stateHandler.getMyState('user1')()
    const state2 = core.stateHandler.getMyState('user2')()

    assert.equal(state1.name, 'Alice')
    assert.equal(state2.name, 'Bob')
})

// ===== Dynamic blacklist =====

test('[CoreClass] dynamicBlacklist should be modifiable at runtime', () => {
    const { flowClass, database, provider, args } = createMockDeps()
    const core = new CoreClass(flowClass, database as any, provider as any, args)

    assert.not.ok(core.dynamicBlacklist.checkIf('newuser'))
    core.dynamicBlacklist.add('newuser')
    assert.ok(core.dynamicBlacklist.checkIf('newuser'))
    core.dynamicBlacklist.remove('newuser')
    assert.not.ok(core.dynamicBlacklist.checkIf('newuser'))
})

test.run()
