import { ServerResponse } from 'http'
import proxyquire from 'proxyquire'
import sinon from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

// Mocks
const utilsMock = {
    generateRefprovider: sinon.stub().returns('refprovider_result'),
    decryptData: sinon.stub().returns('decrypted_path'),
}
const fsMock = {
    existsSync: sinon.stub().returns(true),
    createReadStream: sinon.stub().returns({
        pipe: sinon.spy(),
    }),
}
const mimeMock = {
    lookup: sinon.stub().returns('image/png'),
}

const { TwilioWebHookServer } = proxyquire<typeof import('../src/server')>('../src/server', {
    '@bot-whatsapp/bot': { utils: utilsMock },
    'node:fs': fsMock,
    'mime-types': mimeMock,
})

const twilioPort = 5000
const twilioServer = new TwilioWebHookServer(twilioPort)

test.before.each(() => {
    utilsMock.generateRefprovider.resetHistory()
    fsMock.existsSync.resetHistory()
    fsMock.createReadStream.resetHistory()
    mimeMock.lookup.resetHistory()
})

test('TwilioWebHookServer should emit "ready" when started', () => {
    const readySpy = sinon.spy()
    twilioServer.on('ready', readySpy)
    twilioServer.start()
    assert.is(readySpy.called, true)
})

test('TwilioWebHookServer should handle incoming messages', () => {
    const messageSpy = sinon.spy()
    twilioServer.on('message', messageSpy)

    const fakeReq = {
        body: {
            From: '+1234567890',
            To: '+0987654321',
            Body: 'Hello',
            NumMedia: '0',
        },
    }
    const fakeRes = new ServerResponse(fakeReq as any)
    sinon.stub(fakeRes, 'end')

    twilioServer['incomingMsg'](fakeReq as any, fakeRes as any, fakeRes as any)

    assert.is(messageSpy.called, true)
    assert.equal(messageSpy.firstCall.args[0], {
        from: '1234567890',
        to: '0987654321',
        body: 'Hello',
    })
})

test.after(async () => {
    await twilioServer.stop()
})

test.run()
