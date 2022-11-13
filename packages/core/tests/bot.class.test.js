const { test } = require('uvu')
const assert = require('uvu/assert')
const MockProvider = require('../../../__mocks__/mock.provider')
const { create } = require('../')
const BotClass = require('../classes/bot.class')

class MockFlow {
    find = () => {}
}

class MockDB {
    save = () => {}
}

test(`[BotClass] Probando instanciamiento de clase`, async () => {
    const setting = {
        flow: new MockFlow(),
        database: new MockDB(),
        provider: new MockProvider(),
    }
    const bot = await create(setting)
    assert.is(bot instanceof BotClass, true)
})

test(`[BotClass] Eventos 'require_action,ready,auth_failure,message '`, async () => {
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
        database: new MockDB(),
        provider: mockProvider,
    }
    await create(setting)

    /// Escuchamos eventos
    mockProvider.on(
        'require_action',
        (r) => (responseEvents['require_action'] = r)
    )
    mockProvider.on('ready', (r) => (responseEvents['ready'] = r))
    mockProvider.on('auth_failure', (r) => (responseEvents['auth_failure'] = r))
    mockProvider.on('message', (r) => (responseEvents['message'] = r))

    /// Emitimos eventos
    mockProvider.delaySendMessage(
        0,
        'require_action',
        MOCK_EVENTS.require_action
    )
    mockProvider.delaySendMessage(0, 'ready', MOCK_EVENTS.ready)
    mockProvider.delaySendMessage(0, 'auth_failure', MOCK_EVENTS.auth_failure)
    mockProvider.delaySendMessage(0, 'message', MOCK_EVENTS.message)

    await delay(0)

    /// Testeamos eventos
    assert.is(
        JSON.stringify(responseEvents.require_action),
        JSON.stringify(MOCK_EVENTS.require_action)
    )
    assert.is(responseEvents.ready, MOCK_EVENTS.ready)

    assert.is(
        JSON.stringify(responseEvents.auth_failure),
        JSON.stringify(MOCK_EVENTS.auth_failure)
    )

    assert.is(
        JSON.stringify(responseEvents.message),
        JSON.stringify(MOCK_EVENTS.message)
    )
})

test.run()

function delay(ms) {
    return new Promise((res) => setTimeout(res, ms))
}
