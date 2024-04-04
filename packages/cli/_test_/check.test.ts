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

test('checkOs - returns the operating system correctly  not Windows systems', async () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'linux' })

    const result = await checkOs()
    assert.is(result, 'OS: linux')
    Object.defineProperty(process, 'platform', { value: originalPlatform })
})

test('checkOs - returns the operating system correctly on Windows systems', async () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'win32' })
    const osMessage = await checkOs()
    assert.match(osMessage, /OS: win32/, 'El sistema operativo debería ser win32')
    Object.defineProperty(process, 'platform', { value: originalPlatform })
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
