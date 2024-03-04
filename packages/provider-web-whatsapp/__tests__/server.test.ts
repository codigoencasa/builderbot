import sinon, { spy, stub } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { WebWhatsappHttpServer, inHandleCtx } from '../src/server'

const webWhatsappHttpServer = new WebWhatsappHttpServer('bot', 3006)

test('webWhatsappHttpServer debe construirse correctamente', () => {
    assert.ok(webWhatsappHttpServer instanceof WebWhatsappHttpServer)
    assert.ok(webWhatsappHttpServer.server !== undefined)
    assert.equal(webWhatsappHttpServer.port, 3006)
})

test('start debe actualizar el puerto correctamente si se proporciona un valor', () => {
    webWhatsappHttpServer.start(undefined as any, 4006)
    assert.equal(webWhatsappHttpServer.port, 4006)
})

test('stop method should close the server without error', async () => {
    await webWhatsappHttpServer.stop()
    assert.equal(webWhatsappHttpServer.server?.server?.listening, false)
})

test('start function sets up server and listens on specified port', () => {
    const port = 3000
    const vendor = {}
    const listenStub = stub().callsArg(1)
    webWhatsappHttpServer.server.listen = listenStub
    const consoleLogSpy = spy(console, 'log')
    webWhatsappHttpServer.start(vendor, port)
    assert.equal(consoleLogSpy.called, true)
    assert.equal(listenStub.called, true)
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

test.run()
