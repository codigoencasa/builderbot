const { test } = require('uvu')
const assert = require('uvu/assert')
const FlowClass = require('../io/flow.class')
const MockProvider = require('../../../__mocks__/mock.provider')
const { createBot, CoreClass, createFlow, createProvider, ProviderClass } = require('../index')

class MockFlow {
    allCallbacks = { ref: () => 1 }
    flowSerialize = []
    flowRaw = []
    find = (arg) => {
        if (arg) {
            return [{ answer: 'answer', ref: 'ref' }]
        } else {
            return null
        }
    }
    findBySerialize = () => ({})
    findIndexByRef = () => 0
}

class MockDBA {
    listHistory = []
    save = () => {}
    getPrevByNumber = () => {}
}

class MockDBB {
    listHistory = []
    save = () => {}
    getPrevByNumber = () => ({
        refSerialize: 'xxxxx',
        ref: 'xxxx',
        options: { callback: true },
    })
}

class MockDBC {
    listHistory = []
    save = () => {}
    getPrevByNumber = () => ({
        refSerialize: 'xxxxx',
        ref: 'xxxx',
        options: { callback: true, nested: ['1', '2'] },
    })
    saveLog = () => {}
}

test(`[CoreClass] Probando instanciamiento de clase`, async () => {
    const setting = {
        flow: new MockFlow(),
        database: new MockDBA(),
        provider: new MockProvider(),
    }
    const bot = await createBot(setting)
    assert.is(bot instanceof CoreClass, true)
})

test(`[CoreClass createFlow] Probando instanciamiento de clase`, async () => {
    const mockCreateFlow = createFlow([])
    assert.is(mockCreateFlow instanceof FlowClass, true)
})

test(`[CoreClass createProvider] Probando instanciamiento de clase`, async () => {
    const mockCreateProvider = createProvider(MockProvider)
    assert.is(mockCreateProvider instanceof ProviderClass, true)
})

test(`[Bot] Eventos 'require_action,ready,auth_failure,message '`, async () => {
    let responseEvents = {}

    const MOCK_EVENTS = {
        require_action: {
            instructions: 'Debes...',
        },
        ready: true,
        auth_failure: {
            instructions: 'Error...',
        },
        message: {
            from: 'XXXXXX',
            body: 'hola',
            hasMedia: false,
        },
    }

    const mockProvider = new MockProvider()

    const setting = {
        flow: new MockFlow(),
        database: new MockDBA(),
        provider: mockProvider,
    }
    await createBot(setting)

    /// Escuchamos eventos
    mockProvider.on('require_action', (r) => (responseEvents['require_action'] = r))
    mockProvider.on('ready', (r) => (responseEvents['ready'] = r))
    mockProvider.on('auth_failure', (r) => (responseEvents['auth_failure'] = r))
    mockProvider.on('message', (r) => (responseEvents['message'] = r))

    /// Emitimos eventos
    mockProvider.delaySendMessage(0, 'require_action', MOCK_EVENTS.require_action)
    mockProvider.delaySendMessage(0, 'ready', MOCK_EVENTS.ready)
    mockProvider.delaySendMessage(0, 'auth_failure', MOCK_EVENTS.auth_failure)
    mockProvider.delaySendMessage(0, 'message', MOCK_EVENTS.message)

    await delay(0)

    /// Testeamos eventos
    assert.is(JSON.stringify(responseEvents.require_action), JSON.stringify(MOCK_EVENTS.require_action))
    assert.is(responseEvents.ready, MOCK_EVENTS.ready)

    assert.is(JSON.stringify(responseEvents.auth_failure), JSON.stringify(MOCK_EVENTS.auth_failure))

    assert.is(JSON.stringify(responseEvents.message), JSON.stringify(MOCK_EVENTS.message))
})

test(`[Bot] Probando Flujos Internos`, async () => {
    let responseEvents = {}

    const MOCK_EVENTS = {
        require_action: {
            instructions: 'Debes...',
        },
        ready: true,
        auth_failure: {
            instructions: 'Error...',
        },
        message: {
            from: 'XXXXXX',
            body: 'hola',
            hasMedia: false,
        },
    }

    const mockProvider = new MockProvider()

    const setting = {
        flow: new MockFlow(),
        database: new MockDBB(),
        provider: mockProvider,
    }
    await createBot(setting)

    /// Escuchamos eventos
    mockProvider.on('require_action', (r) => (responseEvents['require_action'] = r))
    mockProvider.on('ready', (r) => (responseEvents['ready'] = r))
    mockProvider.on('auth_failure', (r) => (responseEvents['auth_failure'] = r))
    mockProvider.on('message', (r) => (responseEvents['message'] = r))

    /// Emitimos eventos
    mockProvider.delaySendMessage(0, 'require_action', MOCK_EVENTS.require_action)
    mockProvider.delaySendMessage(0, 'ready', MOCK_EVENTS.ready)
    mockProvider.delaySendMessage(0, 'auth_failure', MOCK_EVENTS.auth_failure)
    mockProvider.delaySendMessage(0, 'message', MOCK_EVENTS.message)

    await delay(0)

    /// Testeamos eventos
    assert.is(JSON.stringify(responseEvents.require_action), JSON.stringify(MOCK_EVENTS.require_action))
    assert.is(responseEvents.ready, MOCK_EVENTS.ready)

    assert.is(JSON.stringify(responseEvents.auth_failure), JSON.stringify(MOCK_EVENTS.auth_failure))

    assert.is(JSON.stringify(responseEvents.message), JSON.stringify(MOCK_EVENTS.message))
})

test(`[Bot] Probando Flujos Nested`, async () => {
    let responseEvents = {}

    const MOCK_EVENTS = {
        require_action: {
            instructions: 'Debes...',
        },
        ready: true,
        auth_failure: {
            instructions: 'Error...',
        },
        message: {
            from: 'XXXXXX',
            body: 'hola',
            hasMedia: false,
        },
    }

    const mockProvider = new MockProvider()

    const setting = {
        flow: new MockFlow(),
        database: new MockDBC(),
        provider: mockProvider,
    }
    const botInstance = await createBot(setting)

    botInstance.sendProviderAndSave('xxxxx', 'xxxxx')
    botInstance.continue('xxxxx', 'xxxxx')
    /// Escuchamos eventos
    mockProvider.on('require_action', (r) => (responseEvents['require_action'] = r))
    mockProvider.on('ready', (r) => (responseEvents['ready'] = r))
    mockProvider.on('auth_failure', (r) => (responseEvents['auth_failure'] = r))
    mockProvider.on('message', (r) => (responseEvents['message'] = r))

    /// Emitimos eventos
    mockProvider.delaySendMessage(0, 'require_action', MOCK_EVENTS.require_action)
    mockProvider.delaySendMessage(0, 'ready', MOCK_EVENTS.ready)
    mockProvider.delaySendMessage(0, 'auth_failure', MOCK_EVENTS.auth_failure)
    mockProvider.delaySendMessage(0, 'message', MOCK_EVENTS.message)

    await delay(0)

    /// Testeamos eventos
    assert.is(JSON.stringify(responseEvents.require_action), JSON.stringify(MOCK_EVENTS.require_action))
    assert.is(responseEvents.ready, MOCK_EVENTS.ready)

    assert.is(JSON.stringify(responseEvents.auth_failure), JSON.stringify(MOCK_EVENTS.auth_failure))

    assert.is(JSON.stringify(responseEvents.message), JSON.stringify(MOCK_EVENTS.message))
})

test.run()

function delay(ms) {
    return new Promise((res) => setTimeout(res, ms))
}
