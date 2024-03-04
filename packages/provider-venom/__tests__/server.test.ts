import sinon from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { VenomHttpServer, inHandleCtx } from '../src/server'

const venomHttpServer = new VenomHttpServer('bot', 3005)

test('VenomHttpServer debe construirse correctamente', () => {
    assert.ok(venomHttpServer instanceof VenomHttpServer)
    assert.ok(venomHttpServer.server !== undefined)
    assert.equal(venomHttpServer.port, 3005)
})

test('start debe actualizar el puerto correctamente si se proporciona un valor', () => {
    venomHttpServer.start(undefined as any, 4005)
    assert.equal(venomHttpServer.port, 4005)
})

test('stop method should close the server without error', async () => {
    const server = new VenomHttpServer('bot', 3005)
    server['start'](undefined as any)
    await server.stop()
    assert.equal(server.server.server?.listening, false)
    server.stop()
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

test.after(() => {
    venomHttpServer.stop()
})

test.run()
