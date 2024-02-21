import * as assert from 'assert'
import { test } from 'uvu'

import { VenomHttpServer, handleCtx } from '../src/server'

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

const venomHttpServer = new VenomHttpServer('bot', 3005)

test('VenomHttpServer debe construirse correctamente', () => {
    assert.ok(venomHttpServer instanceof VenomHttpServer)
    assert.ok(venomHttpServer.server !== undefined)
    assert.strictEqual(venomHttpServer.port, 3005)
})

test('start debe actualizar el puerto correctamente si se proporciona un valor', () => {
    venomHttpServer.start(undefined as any, 4005)
    assert.strictEqual(venomHttpServer.port, 4005)
})

test('handleCtx - function should call provided function with correct arguments', () => {
    const testFn = (__, req: any, res: any) => {
        assert.equal(req, mockRequest)
        assert.equal(res, mockResponse)
        res.end('T')
    }

    const handler = handleCtx(testFn)
    handler(mockRequest, mockResponse)
    assert.equal(mockResponse.status, 400)
})

test('stop method should close the server without error', async () => {
    const server = new VenomHttpServer('bot', 3005)
    server['start'](undefined as any)
    await server.stop()
    assert.equal(server.server.server?.listening, false)
    server.stop()
})

test.after(() => {
    venomHttpServer.stop()
})

test.run()
