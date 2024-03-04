import * as assert from 'uvu/assert'
import fs from 'fs'
import sinon, { spy, stub } from 'sinon'
import { test } from 'uvu'

import { WPPConnectHttpServer, inHandleCtx } from '../src/server'

const wPPConnectHttpServer = new WPPConnectHttpServer('bot', 3007)

test('webWhatsappHttpServer debe construirse correctamente', () => {
    assert.ok(wPPConnectHttpServer instanceof WPPConnectHttpServer)
    assert.ok(wPPConnectHttpServer.server !== undefined)
    assert.equal(wPPConnectHttpServer.port, 3007)
})

test('start debe actualizar el puerto correctamente si se proporciona un valor', () => {
    wPPConnectHttpServer.start(undefined as any, 4007)
    assert.equal(wPPConnectHttpServer.port, 4007)
})

test('stop method should close the server without error', async () => {
    await wPPConnectHttpServer.stop()
    assert.equal(wPPConnectHttpServer.server?.server?.listening, false)
})

test('indexHome- It should return the type content of the image', async () => {
    stub(fs, 'createReadStream').returns({ pipe: stub() } as any)
    const req: any = stub()
    const res: any = {
        writeHead: stub(),
        pipe: stub(),
    }
    const next = stub()

    wPPConnectHttpServer['indexHome'](req, res, next)
    assert.equal(res.writeHead.called, true)
    assert.equal(res.writeHead.firstCall.args[0], 200)
})

test('inHandleCtx', async () => {
    const reqMock = {}
    const resMock = { end: sinon.spy(), writeHead: sinon.spy() }
    const sendMessage = () => 'test'
    const inside = async (bot: { sendMessage: any }, req: {}, res: { end: any }) => {
        if (bot) {
            await bot.sendMessage('number', 'message', {})
            return res.end('send')
        }
    }

    const outside = inHandleCtx(await inside({ sendMessage }, reqMock, resMock))
    await outside(reqMock, resMock)
    assert.is(resMock.writeHead.calledWith(400), true)
})

test('start function sets up server and listens on specified port', () => {
    const port = 3000
    const vendor = {}
    const listenStub = stub().callsArg(1)
    wPPConnectHttpServer.server.listen = listenStub
    const consoleLogSpy = spy(console, 'log')
    wPPConnectHttpServer.start(vendor, port)
    assert.equal(consoleLogSpy.called, true)
    assert.equal(listenStub.called, true)
})

test.run()
