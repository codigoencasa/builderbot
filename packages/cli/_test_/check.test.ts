import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { checkNodeVersion, checkOs, checkGit } from '../src/check'

test('checkNodeVersion', async () => {
    const result = await checkNodeVersion()
    assert.type(checkNodeVersion, 'function')
    assert.type(result, 'object')
    assert.type(result.pass, 'boolean')
    assert.type(result.message, 'string')
    assert.ok(result.pass, 'La versión de Node.js debería ser 18 o superior')
})

test('checkOs', async () => {
    const osMessage = await checkOs()
    assert.type(checkOs, 'function')
    assert.type(osMessage, 'string')
    assert.match(osMessage, /OS: win32/, 'El sistema operativo debería ser win32')
})

test('checkGit', async () => {
    try {
        const result = await checkGit()
        assert.type(checkGit, 'function')
        assert.type(result, 'object')
        assert.type(result.pass, 'boolean')
        assert.type(result.message, 'string')

        assert.ok(result.pass, 'Git debería estar instalado y ser compatible')
    } catch (error) {
        assert.unreachable('No se pudo ejecutar `git --version`, asegúrese de que Git esté instalado')
    }
})

test.run()
