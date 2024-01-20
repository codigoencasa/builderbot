import { spy, stub } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { MetaWebHookServer } from '../src/server'

const server = new MetaWebHookServer('jwtToken', 'numberId', 'version', 'token', 3000)

test('should create MetaWebHookServer instance', () => {
    console.assert(server instanceof MetaWebHookServer)
})

test('start -should start MetaWebHookServer and emit "ready"', () => {
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
    const res = { statusCode: 0, end: spy() }
    metaWebHookServer.verifyToken(req, res)
    assert.is(res.statusCode, 403)
    assert.is(res.end.calledWith('No token!'), true)
})

test('verifyToken - should return 403 and "Invalid token!" if token is invalid', () => {
    const metaWebHookServer = new MetaWebHookServer('valid-jwt', '123', 'v1', 'valid-token')
    const req = { query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'invalid-token' } }
    const res = { statusCode: 0, end: spy() }
    metaWebHookServer.verifyToken(req, res)
    assert.is(res.statusCode, 403)
    assert.is(res.end.calledWith('Invalid token!'), true)
})

test('verifyToken - should return 200 and the challenge if token is valid', () => {
    const metaWebHookServer = new MetaWebHookServer('valid-jwt', '123', 'v1', 'valid-token')
    const challengeValue = 'some-challenge'
    const req = {
        query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'valid-token', 'hub.challenge': challengeValue },
    }
    const res = { statusCode: 0, end: spy() }
    metaWebHookServer.verifyToken(req, res)
    assert.is(res.statusCode, 200)
    assert.is(res.end.calledWith(challengeValue), true)
})

test('emptyCtrl - should call res.end with an empty string', () => {
    const metaWebHookServer = new MetaWebHookServer('valid-jwt', '123', 'v1', 'valid-token')
    const req = {}
    const res = { end: spy() }
    metaWebHookServer.emptyCtrl(req, res)
    assert.is(res.end.calledWith(''), true)
})

test.run()
