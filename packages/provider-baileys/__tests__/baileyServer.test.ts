import * as assert from 'assert'
import { test } from 'uvu'

import { BaileyHttpServer, handleCtx } from '../src/server'

const mockRequest = {}
const mockResponse = {
    status: 200,
    data: '',
    end: function (data: string) {
        this.data = data
    },
}

const baileyHttpServer = new BaileyHttpServer(3000)

test('BaileyHttpServer debe construirse correctamente', () => {
    assert.ok(baileyHttpServer instanceof BaileyHttpServer)
    assert.ok(baileyHttpServer.server !== undefined)
    assert.strictEqual(baileyHttpServer.port, 3000)
})

test('start debe actualizar el puerto correctamente si se proporciona un valor', () => {
    baileyHttpServer.start(undefined as any, 4000)

    assert.strictEqual(baileyHttpServer.port, 4000)
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
    const server = new BaileyHttpServer(500)
    server['start'](undefined as any)
    await server.stop()
    assert.equal(server.server.server?.listening, false)
})

test.run()
