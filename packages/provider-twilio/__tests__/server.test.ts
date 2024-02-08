import sinon, { stub } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { TwilioPayload, TwilioWebHookServer } from '../src/server'

const emitStub = stub()

let twilioServer: TwilioWebHookServer

test.before(async () => {
    twilioServer = new TwilioWebHookServer(5000)
})

test.before.each(() => {
    emitStub.resetHistory()
})

test('[TwilioWebHookServer] - instantiation', () => {
    assert.instance(twilioServer, TwilioWebHookServer)
})

test('TwilioWebHookServer should emit "ready" when started', () => {
    const readySpy = sinon.spy()
    twilioServer.on('ready', readySpy)
    twilioServer.start({})
    assert.is(readySpy.called, true)
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

test('should handle incoming message with audio', () => {
    const req: any = {
        body: {
            From: '123456',
            To: '78910',
            Body: 'Test message',
            MediaContentType0: 'audio/jpeg',
            NumMedia: '1',
        },
    }
    const res: any = {
        end: stub(),
    }
    twilioServer.emit = emitStub
    twilioServer['incomingMsg'](req as any, res as any, res as any)

    const expectedPayload: TwilioPayload = {
        from: '123456',
        to: '78910',
        body: '_event_voice_note_',
    }
    assert.equal(emitStub.calledOnce, true)
    assert.equal(emitStub.args[0][0], 'message')
    assert.equal(emitStub.args[0][1].from, expectedPayload.from)
    assert.equal(emitStub.args[0][1].to, expectedPayload.to)
    assert.equal(emitStub.args[0][1].body.includes(expectedPayload.body), true)
    assert.equal(res.end.calledOnce, true)
})

test('should handle incoming message with image', () => {
    const req: any = {
        body: {
            From: '123456',
            To: '78910',
            Body: 'Test message',
            MediaContentType0: 'image/jpeg',
            NumMedia: '1',
        },
    }
    const res: any = {
        end: stub(),
    }
    twilioServer.emit = emitStub
    twilioServer['incomingMsg'](req as any, res as any, res as any)

    const expectedPayload: TwilioPayload = {
        from: '123456',
        to: '78910',
        body: '_event_media_',
    }
    assert.equal(emitStub.calledOnce, true)
    assert.equal(emitStub.args[0][0], 'message')
    assert.equal(emitStub.args[0][1].from, expectedPayload.from)
    assert.equal(emitStub.args[0][1].to, expectedPayload.to)
    assert.equal(emitStub.args[0][1].body.includes(expectedPayload.body), true)
    assert.equal(res.end.calledOnce, true)
})

test('should handle incoming message with video', () => {
    const req: any = {
        body: {
            From: '123456',
            To: '78910',
            Body: 'Test message',
            MediaContentType0: 'video/jpeg',
            NumMedia: '1',
        },
    }
    const res: any = {
        end: stub(),
    }
    twilioServer.emit = emitStub

    twilioServer['incomingMsg'](req as any, res as any, res as any)

    const expectedPayload: TwilioPayload = {
        from: '123456',
        to: '78910',
        body: '_event_media_',
    }
    assert.is(emitStub.calledOnce, true)
    assert.equal(emitStub.firstCall.args[0], 'message')
    assert.ok(emitStub.firstCall.args[1].from, expectedPayload.from)
    assert.ok(emitStub.firstCall.args[1].to, expectedPayload.to)
    assert.ok(emitStub.firstCall.args[1].body.includes(expectedPayload.body))
    assert.is(res.end.calledOnce, true)
})

test('should handle incoming message with application', () => {
    const req: any = {
        body: {
            From: '123456',
            To: '78910',
            Body: 'Test message',
            MediaContentType0: 'application/jpeg',
            NumMedia: '1223',
        },
    }
    const res: any = {
        end: stub(),
    }
    twilioServer.emit = emitStub
    twilioServer['incomingMsg'](req as any, res as any, res as any)

    const expectedPayload: TwilioPayload = {
        from: '123456',
        to: '78910',
        body: '_event_document_',
    }
    assert.is(emitStub.calledOnce, true)
    assert.equal(emitStub.firstCall.args[0], 'message')
    assert.ok(emitStub.firstCall.args[1].from, expectedPayload.from)
    assert.ok(emitStub.firstCall.args[1].to, expectedPayload.to)
    assert.ok(emitStub.firstCall.args[1].body.includes(expectedPayload.body))
    assert.is(res.end.calledOnce, true)
})

test('should handle incoming message with text', () => {
    const req: any = {
        body: {
            From: '123456',
            To: '78910',
            Body: 'Test message',
            MediaContentType0: 'text/jpeg',
            NumMedia: '1223',
        },
    }
    const res: any = {
        end: stub(),
    }
    twilioServer.emit = emitStub
    twilioServer['incomingMsg'](req as any, res as any, res as any)

    const expectedPayload: TwilioPayload = {
        from: '123456',
        to: '78910',
        body: '_event_contacts_',
    }
    assert.is(emitStub.calledOnce, true)
    assert.equal(emitStub.firstCall.args[0], 'message')
    assert.ok(emitStub.firstCall.args[1].from, expectedPayload.from)
    assert.ok(emitStub.firstCall.args[1].to, expectedPayload.to)
    assert.ok(emitStub.firstCall.args[1].body.includes(expectedPayload.body))
    assert.is(res.end.calledOnce, true)
})

test('incomingMsg - break', () => {
    const req: any = {
        body: {
            From: '123456',
            To: '78910',
            Body: 'Test message',
            MediaContentType0: 'test/jpeg',
            NumMedia: '1223',
        },
    }
    const res: any = {
        end: stub(),
    }
    twilioServer.emit = emitStub
    twilioServer['incomingMsg'](req as any, res as any, res as any)
    assert.equal(emitStub.firstCall.args[1].body, 'Test message')
    assert.equal(emitStub.firstCall.args[1].From, undefined)
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
        end: stub(),
    }
    twilioServer.emit = emitStub
    twilioServer['incomingMsg'](req as any, res as any, res as any)

    const expectedPayload: TwilioPayload = {
        from: '123456',
        to: '78910',
        body: '_event_location_',
    }

    assert.is(emitStub.calledOnce, true)
    assert.equal(emitStub.firstCall.args[0], 'message')
    assert.ok(emitStub.firstCall.args[1].from, expectedPayload.from)
    assert.ok(emitStub.firstCall.args[1].to, expectedPayload.to)
    assert.ok(emitStub.firstCall.args[1].body.includes(expectedPayload.body))
    assert.is(res.end.calledOnce, true)
})

test('stop - stops the HTTP server correctly', async () => {
    assert.ok(twilioServer.server.server?.listening)

    await twilioServer.stop()
    assert.not.ok(twilioServer.server.server.listening)
})

test.run()
