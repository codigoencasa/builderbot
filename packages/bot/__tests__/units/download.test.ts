import { EventEmitter } from 'events'
import { tmpdir } from 'os'
import { join } from 'path'
import proxyquire from 'proxyquire'
import sinon from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

const httpMock = {
    get: sinon.stub(),
}
const httpsMock = {
    get: sinon.stub(),
}
const fsMock = {
    rename: sinon.stub(),
    createWriteStream: sinon.stub(),
    existsSync: sinon.stub(),
}
const osMock = {
    tmpdir: sinon.stub().returns('/tmp'),
}

interface MockResponse extends EventEmitter {
    headers: { [key: string]: string | string[] | undefined }
    close: any
}

// Importamos el módulo con las dependencias simuladas
const { generalDownload } = proxyquire('../../src/utils/download', {
    http: httpMock,
    https: httpsMock,
    fs: fsMock,
    os: osMock,
    'follow-redirects': {
        http: httpMock,
        https: httpsMock,
    },
})

// Escribimos nuestras pruebas
test('generalDownload - should download a file from a URL', async () => {
    const fakeResponse: MockResponse = new EventEmitter() as MockResponse
    fakeResponse.headers = { 'content-type': 'image/png' }
    const fakeStream: MockResponse = new EventEmitter() as MockResponse
    fakeStream.close = sinon.stub()
    httpMock.get.callsFake((_, callback) => {
        callback(fakeResponse)
        return fakeStream
    })
    fsMock.createWriteStream.returns(fakeStream)
    fsMock.existsSync.returns(false)
    fsMock.rename.callsFake((__, _, callback) => callback(null))
    const fileName = '2whHCbI.png'
    const url = `https://i.imgur.com/${fileName}`
    const downloadedPath = await generalDownload(url)
    assert.equal(downloadedPath, join(tmpdir(), fileName))
})

test.run()
