import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { join } from 'path'
import sinon from 'sinon'
import proxyquire from 'proxyquire'

const rimrafStub = sinon.stub().callsArgWith(1, null)

const { cleanSession } = proxyquire('../src/clean', {
    rimraf: rimrafStub,
})

const consoleLogSpy = sinon.spy(console, 'log')

test.before.each(() => {
    rimrafStub.resetHistory()
    consoleLogSpy.resetHistory()
})

test('cleanSession - elimina las rutas especificadas', async () => {
    const results = await cleanSession()
    rimrafStub.calledWith(join(process.cwd(), '.wwebjs_auth'))
    rimrafStub.calledWith(join(process.cwd(), 'session.json'))
    assert.equal(results, [true, true])
})

test.run()

test.after(() => {
    consoleLogSpy.restore()
})
