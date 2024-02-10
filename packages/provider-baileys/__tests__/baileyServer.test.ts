import * as assert from 'assert'
import fs from 'fs'
import { stub } from 'sinon'
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

const baileyHttpServer = new BaileyHttpServer(3001)

test('BaileyHttpServer debe construirse correctamente', () => {
    assert.ok(baileyHttpServer instanceof BaileyHttpServer)
    assert.ok(baileyHttpServer.server !== undefined)
    assert.strictEqual(baileyHttpServer.port, 3001)
})

test('start should update the port correctly if a value is provided', () => {
    baileyHttpServer.start(undefined as any, 4001)

    assert.strictEqual(baileyHttpServer.port, 4001)
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

test('indexHome- It should return the type content of the image', async () => {
    stub(fs, 'createReadStream').returns({ pipe: stub() } as any)
    const req = {}
    const res = {
        writeHead: stub(),
        pipe: stub(),
    }

    baileyHttpServer['indexHome'](req, res)
    assert.equal(res.writeHead.called, true)
    assert.equal(res.writeHead.firstCall.args[0], 200)
})

test.run()
