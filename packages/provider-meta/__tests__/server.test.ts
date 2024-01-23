import { spy, stub } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { MetaWebHookServer } from '../src/server'
import { Message } from '../src/types'

const resMock = {
    statusCode: 0,
    end: spy(),
}

test('should create MetaWebHookServer instance', async () => {
    const server = new MetaWebHookServer('jwtToken', 'numberId', 'version', 'token', 3001)
    server.start()
    assert.is(server['metaPort'], 3001)
    assert.is(server['jwtToken'], 'jwtToken')
    await server.stop()
})

test('start -should start MetaWebHookServer and emit "ready"', async () => {
    const server = new MetaWebHookServer('jwtToken', 'numberId', 'version', 'token', 3002)
    const emitSpy = stub(server, 'emit')
    const metaServerSpy = stub(server['metaServer'], 'listen')
    server.start()
    assert.equal(emitSpy.calledWith('ready'), true)
    assert.equal(metaServerSpy.called, true)
})

test('tokenIsValid - method should return true for valid token', () => {
    const metaWebHookServer = new MetaWebHookServer('valid-jwt', '123', 'v1', 'valid-token')
    const result = metaWebHookServer.tokenIsValid('subscribe', 'valid-token')
    assert.equal(result, true)
})

test('tokenIsValid method should return false for invalid token', () => {
    const metaWebHookServer = new MetaWebHookServer('valid-jwt', '123', 'v1', 'valid-token')
    const result = metaWebHookServer.tokenIsValid('subscribe', 'invalid-token')
    assert.equal(result, false)
})

test('verifyToken - should return 403 and "No token!" if mode or token are missing', () => {
    const metaWebHookServer = new MetaWebHookServer('valid-jwt', '123', 'v1', 'valid-token')
    const req = { query: {} }

    metaWebHookServer.verifyToken(req, resMock)
    assert.is(resMock.statusCode, 403)
    assert.is(resMock.end.calledWith('No token!'), true)
})

test('verifyToken - should return 403 and "Invalid token!" if token is invalid', () => {
    const metaWebHookServer = new MetaWebHookServer('valid-jwt', '123', 'v1', 'valid-token')
    const req = { query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'invalid-token' } }
    metaWebHookServer.verifyToken(req, resMock)
    assert.is(resMock.statusCode, 403)
    assert.is(resMock.end.calledWith('Invalid token!'), true)
})

test('verifyToken - should return 200 and the challenge if token is valid', () => {
    const metaWebHookServer = new MetaWebHookServer('valid-jwt', '123', 'v1', 'valid-token')
    const challengeValue = 'some-challenge'
    const req = {
        query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'valid-token', 'hub.challenge': challengeValue },
    }
    metaWebHookServer.verifyToken(req, resMock)
    assert.is(resMock.statusCode, 200)
    assert.is(resMock.end.calledWith(challengeValue), true)
})

test('emptyCtrl - should call res.end with an empty string', () => {
    const metaWebHookServer = new MetaWebHookServer('valid-jwt', '123', 'v1', 'valid-token')
    const req = {}
    metaWebHookServer.emptyCtrl(req, resMock)
    assert.is(resMock.end.calledWith(''), true)
})

test('processMessage emits the correct message', () => {
    const server = new MetaWebHookServer('jwtToken', 'numberId', 'version', 'token', 3000)
    const mockEmit = spy(server, 'emit')
    const message: Message = {
        type: 'text',
        from: 'sender',
        to: 'recipient',
        body: 'Hello!',
        pushName: 'John Doe',
    }
    server.processMessage(message)
    assert.equal(mockEmit.calledWith('message', message), true)
})

test('incomingMsg - incomingMsg should process messages correctly', async () => {
    const server = new MetaWebHookServer('jwtToken', 'numberId', 'version', 'token', 3000)
    const message = { type: 'text', from: 'sender', to: 'receiver', body: 'Hello!' }
    const req = {
        body: {
            entry: [
                {
                    changes: [
                        {
                            value: {
                                messages: [message],
                                contacts: [{ profile: { name: 'John Doe' } }],
                                metadata: { display_phone_number: '+123456789' },
                            },
                        },
                    ],
                },
            ],
        },
    }

    const enqueueStub = spy(server['messageQueue'], 'enqueue')
    await server.incomingMsg(req, resMock)
    assert.equal(resMock.statusCode, 200)
    assert.ok(resMock.end.calledWith('Messages enqueued'))
    assert.ok(enqueueStub.called)
})
test('incomingMsg - No debe llamar el metodo messageQueuey retornar el mensaje empty endpoint ', async () => {
    const server = new MetaWebHookServer('jwtToken', 'numberId', 'version', 'token', 3000)
    const req = {
        body: {
            entry: [
                {
                    changes: [
                        {
                            value: {
                                messages: [],
                                contacts: [{ profile: { name: 'John Doe' } }],
                                metadata: { display_phone_number: '+123456789' },
                            },
                        },
                    ],
                },
            ],
        },
    }
    const enqueueStub = spy(server['messageQueue'], 'enqueue')
    await server.incomingMsg(req, resMock)
    assert.equal(resMock.statusCode, 200)
    assert.ok(resMock.end.calledWith('empty endpoint'))
    assert.ok(enqueueStub.notCalled)
})

test.run()
