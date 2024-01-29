import { ServerResponse } from 'http'
import proxyquire from 'proxyquire'
import sinon, { spy, stub } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { TwilioPayload } from '../src/server'

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
const emitSpy = spy(twilioServer, 'emit')

test.before.each(() => {
    utilsMock.generateRefprovider.resetHistory()
    fsMock.existsSync.resetHistory()
    fsMock.createReadStream.resetHistory()
    mimeMock.lookup.resetHistory()
    emitSpy.resetHistory()
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

test('start - should start the server and emit "ready" event', async () => {
    const listenStub = stub(twilioServer.twilioServer, 'listen').yields()
    twilioServer.start()
    assert.is(listenStub.calledOnce, true)
    assert.is(emitSpy.calledOnce, true)
    assert.is(emitSpy.calledWith('ready'), true)
})

test('should handle invalid path', () => {
    const req = {
        query: {},
    }
    const res = {
        end: stub(),
        writeHead: stub(),
    }
    twilioServer['handlerLocalMedia'](req as any, res as any, res as any)

    assert.is(res.writeHead.called, false)
    assert.is(res.end.calledOnce, true)
    assert.is(res.end.calledWith('path: invalid'), true)
})

test('should handle incoming message with media', () => {
    const req: any = {
        body: {
            From: '123456',
            To: '78910',
            Body: 'Test message',
            MediaContentType0: 'image/jpeg',
        },
    }
    const res: any = {
        end: spy(),
    }

    twilioServer['incomingMsg'](req as any, res as any, res as any)

    const expectedPayload: TwilioPayload = {
        from: '123456',
        to: '78910',
        body: '_event_media_',
    }
    assert.is(emitSpy.calledOnce, true)
    assert.equal(emitSpy.firstCall.args[0], 'message')
    assert.ok(emitSpy.firstCall.args[1].from, expectedPayload.from)
    assert.ok(emitSpy.firstCall.args[1].to, expectedPayload.to)
    assert.ok(emitSpy.firstCall.args[1].body.includes('_event_media_'))
    assert.is(res.end.calledOnce, true)
})

test('should handle incoming message with audio', () => {
    const req: any = {
        body: {
            From: '123456',
            To: '78910',
            Body: 'Test message',
            MediaContentType0: 'audio/jpeg',
        },
    }
    const res: any = {
        end: spy(),
    }

    twilioServer['incomingMsg'](req as any, res as any, res as any)

    const expectedPayload: TwilioPayload = {
        from: '123456',
        to: '78910',
        body: '_event_voice_note_',
    }
    assert.is(emitSpy.calledOnce, true)
    assert.equal(emitSpy.firstCall.args[0], 'message')
    assert.ok(emitSpy.firstCall.args[1].from, expectedPayload.from)
    assert.ok(emitSpy.firstCall.args[1].to, expectedPayload.to)
    assert.ok(emitSpy.firstCall.args[1].body.includes(expectedPayload.body))
    assert.is(res.end.calledOnce, true)
})

test('should handle incoming message with application', () => {
    const req: any = {
        body: {
            From: '123456',
            To: '78910',
            Body: 'Test message',
            MediaContentType0: 'application/jpeg',
        },
    }
    const res: any = {
        end: spy(),
    }

    twilioServer['incomingMsg'](req as any, res as any, res as any)

    const expectedPayload: TwilioPayload = {
        from: '123456',
        to: '78910',
        body: '_event_document_',
    }
    assert.is(emitSpy.calledOnce, true)
    assert.equal(emitSpy.firstCall.args[0], 'message')
    assert.ok(emitSpy.firstCall.args[1].from, expectedPayload.from)
    assert.ok(emitSpy.firstCall.args[1].to, expectedPayload.to)
    assert.ok(emitSpy.firstCall.args[1].body.includes(expectedPayload.body))
    assert.is(res.end.calledOnce, true)
})

test('should handle incoming message with text', () => {
    const req: any = {
        body: {
            From: '123456',
            To: '78910',
            Body: 'Test message',
            MediaContentType0: 'text/jpeg',
        },
    }
    const res: any = {
        end: spy(),
    }

    twilioServer['incomingMsg'](req as any, res as any, res as any)

    const expectedPayload: TwilioPayload = {
        from: '123456',
        to: '78910',
        body: '_event_contacts_',
    }
    assert.is(emitSpy.calledOnce, true)
    assert.equal(emitSpy.firstCall.args[0], 'message')
    assert.ok(emitSpy.firstCall.args[1].from, expectedPayload.from)
    assert.ok(emitSpy.firstCall.args[1].to, expectedPayload.to)
    assert.ok(emitSpy.firstCall.args[1].body.includes(expectedPayload.body))
    assert.is(res.end.calledOnce, true)
})
test('incomingMsg - break', () => {
    const req: any = {
        body: {
            From: '123456',
            To: '78910',
            Body: 'Test message',
            MediaContentType0: 'test/jpeg',
        },
    }
    const res: any = {
        end: spy(),
    }

    twilioServer['incomingMsg'](req as any, res as any, res as any)

    assert.equal(emitSpy.firstCall.args[1].body, 'Test message')
    assert.equal(emitSpy.firstCall.args[1].From, undefined)
})

test('should handle incoming message without media', () => {
    const req: any = {
        body: {
            From: '123456',
            To: '78910',
            Body: 'Test message',
            NumMedia: '0',
            Latitude: '12.34',
            Longitude: '56.78',
        },
    }
    const res: any = {
        end: spy(),
    }

    twilioServer['incomingMsg'](req as any, res as any, res as any)

    const expectedPayload: TwilioPayload = {
        from: '123456',
        to: '78910',
        body: '_event_location_',
    }

    assert.is(emitSpy.calledOnce, true)
    assert.equal(emitSpy.firstCall.args[0], 'message')
    assert.ok(emitSpy.firstCall.args[1].from, expectedPayload.from)
    assert.ok(emitSpy.firstCall.args[1].to, expectedPayload.to)
    assert.ok(emitSpy.firstCall.args[1].body.includes(expectedPayload.body))
    assert.is(res.end.calledOnce, true)
})

test.after(async () => {
    await twilioServer.stop()
})

test.run()
