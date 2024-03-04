import * as assert from 'uvu/assert'
import sinon from 'sinon'
import { test } from 'uvu'

import { BaileyHttpServer, inHandleCtx } from '../src/server'

const baileyHttpServer = new BaileyHttpServer(3001)

test('BaileyHttpServer debe construirse correctamente', () => {
    assert.ok(baileyHttpServer instanceof BaileyHttpServer)
    assert.ok(baileyHttpServer.server !== undefined)
    assert.equal(baileyHttpServer.port, 3001)
})

test('start should update the port correctly if a value is provided', () => {
    baileyHttpServer.start(undefined as any, 4001)

    assert.equal(baileyHttpServer.port, 4001)
})

test('stop method should close the server without error', async () => {
    const server = new BaileyHttpServer(500)
    server['start'](undefined as any)
    await server.stop()
    assert.equal(server.server.server?.listening, false)
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
