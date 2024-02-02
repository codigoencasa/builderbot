import { test } from 'uvu'
import * as assert from 'assert'
import { BaileyHttpServer } from '../src/server'

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

test.run()
