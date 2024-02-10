import * as assert from 'assert'
import fs from 'fs'
import { spy, stub } from 'sinon'
import { test } from 'uvu'

import { WebWhatsappHttpServer, handleCtx } from '../src/server'

const mockRequest = {}
const mockResponse = {
    status: 200,
    data: '',
    end: function (data: string) {
        this.data = data
    },
}

const webWhatsappHttpServer = new WebWhatsappHttpServer('bot', 3006)

test('webWhatsappHttpServer debe construirse correctamente', () => {
    assert.ok(webWhatsappHttpServer instanceof WebWhatsappHttpServer)
    assert.ok(webWhatsappHttpServer.server !== undefined)
    assert.strictEqual(webWhatsappHttpServer.port, 3006)
})

test('start debe actualizar el puerto correctamente si se proporciona un valor', () => {
    webWhatsappHttpServer.start(undefined as any, 4006)
    assert.strictEqual(webWhatsappHttpServer.port, 4006)
})

test('handleCtx - function should call provided function with correct arguments', () => {
    const testFn = (__, req: any, res: any) => {
        assert.equal(req, mockRequest)
        assert.equal(res, mockResponse)
        res.end('Test completed')
    }

    const handler = handleCtx(testFn)
    handler(mockRequest, mockResponse)
    assert.equal(mockResponse.data, 'Test completed')
})

test('stop method should close the server without error', async () => {
    await webWhatsappHttpServer.stop()
    assert.equal(webWhatsappHttpServer.server?.server?.listening, false)
})

test('indexHome- It should return the type content of the image', async () => {
    stub(fs, 'createReadStream').returns({ pipe: stub() } as any)
    const req = {}
    const res = {
        writeHead: stub(),
        pipe: stub(),
    }

    webWhatsappHttpServer['indexHome'](req, res)
    assert.equal(res.writeHead.called, true)
    assert.equal(res.writeHead.firstCall.args[0], 200)
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

test.run()
