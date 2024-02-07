import * as assert from 'assert'
import { test } from 'uvu'

import { WPPConnectHttpServer, handleCtx } from '../src/server'

const mockRequest = {}
const mockResponse = {
    status: 200,
    data: '',
    end: function (data: string) {
        this.data = data
    },
}

const wPPConnectHttpServer = new WPPConnectHttpServer('bot', 3000)

test('webWhatsappHttpServer debe construirse correctamente', () => {
    assert.ok(wPPConnectHttpServer instanceof WPPConnectHttpServer)
    assert.ok(wPPConnectHttpServer.server !== undefined)
    assert.strictEqual(wPPConnectHttpServer.port, 3000)
})

test('start debe actualizar el puerto correctamente si se proporciona un valor', () => {
    wPPConnectHttpServer.start(undefined as any, 4000)
    assert.strictEqual(wPPConnectHttpServer.port, 4000)
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
    await wPPConnectHttpServer.stop()
    assert.equal(wPPConnectHttpServer.server?.server?.listening, false)
})

test.run()
