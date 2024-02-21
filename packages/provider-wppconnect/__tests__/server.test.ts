import * as assert from 'assert'
import fs from 'fs'
import { spy, stub } from 'sinon'
import { test } from 'uvu'

import { WPPConnectHttpServer, handleCtx } from '../src/server'

const mockRequest = {}
const mockResponse = {
    status: 400,
    data: '',
    end: function (data: string) {
        this.data = data
    },
    writeHead: function () {
        return ''
    },
}
const wPPConnectHttpServer = new WPPConnectHttpServer('bot', 3007)

test('webWhatsappHttpServer debe construirse correctamente', () => {
    assert.ok(wPPConnectHttpServer instanceof WPPConnectHttpServer)
    assert.ok(wPPConnectHttpServer.server !== undefined)
    assert.strictEqual(wPPConnectHttpServer.port, 3007)
})

test('start debe actualizar el puerto correctamente si se proporciona un valor', () => {
    wPPConnectHttpServer.start(undefined as any, 4007)
    assert.strictEqual(wPPConnectHttpServer.port, 4007)
})

test('handleCtx - function should call provided function with correct arguments', () => {
    const testFn = (__, req: any, res: any) => {
        assert.equal(req, mockRequest)
        assert.equal(res, mockResponse)
        res.end('Test completed')
    }

    const handler = handleCtx(testFn)
    handler(mockRequest, mockResponse)
    assert.equal(mockResponse.status, 400)
})

test('stop method should close the server without error', async () => {
    await wPPConnectHttpServer.stop()
    assert.equal(wPPConnectHttpServer.server?.server?.listening, false)
})

test('indexHome- It should return the type content of the image', async () => {
    stub(fs, 'createReadStream').returns({ pipe: stub() } as any)
    const req = {}
    const res = {
        writeHead: stub(),
        pipe: stub(),
    }

    wPPConnectHttpServer['indexHome'](req, res)
    assert.equal(res.writeHead.called, true)
    assert.equal(res.writeHead.firstCall.args[0], 200)
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
