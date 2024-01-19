import { test } from 'uvu'
import { tmpdir } from 'os'
import * as assert from 'uvu/assert'
import sinon, { SinonStub, stub } from 'sinon'
import proxyquire from 'proxyquire'
import { join } from 'path'
import { promises as fsPromises } from 'fs'

interface SharpMock {
    extend: SinonStub
    toFile: SinonStub
}

// Create a stub object with the methods we want to mock
const sharpMock: SharpMock = {
    extend: stub().returnsThis(),
    toFile: stub().yields(null),
}

// Mocking fsPromises.readFile
const readFileMock = sinon.stub(fsPromises, 'readFile')

// Proxyquire to replace sharp and fsPromises with our mocks
const { cleanImage } = proxyquire('../../src/utils/cleanImage', {
    sharp: () => sharpMock,
    fs: { promises: { readFile: readFileMock } },
})

test.before.each(() => {
    // Reset the history for mocks before each test
    sharpMock.extend.resetHistory()
    sharpMock.toFile.resetHistory()
    readFileMock.reset()
})

test('cleanImage - throws error when no path is provided', async () => {
    try {
        await cleanImage(null)
        assert.unreachable('cleanImage should have thrown an error')
    } catch (error) {
        assert.instance(error, Error)
        assert.is(error.message, 'No se proporcionó una ruta de archivo válida.')
    }
})

test('cleanImage - processes image with a border', async () => {
    const pixelBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAABAAEAAwYAAAAAAAEAAAABAQAAAAAAAAEAAABgK2PGAAAAmklEQVR42mP8/wPAAwAB/QLP6P6XAAAAAElFTkSuQmCC'
    const fakePath = join(tmpdir(), 'fake.png')
    const fakeBuffer = Buffer.from(pixelBase64, 'base64')
    readFileMock.resolves(fakeBuffer)
    await cleanImage(fakePath)

    assert.ok(readFileMock.calledWith(fakePath), 'readFile should be called with the provided path')
})

test('cleanImage - rejects promise on sharp error', async () => {
    const fakePath = 'path/to/image.jpg'
    const fakeBuffer = Buffer.from('fake_image_data')
    const fakeError = new Error('sharp error')
    readFileMock.resolves(fakeBuffer)
    sharpMock.toFile.yields(fakeError)

    try {
        await cleanImage(fakePath)
        assert.unreachable('cleanImage should have rejected the promise')
    } catch (error) {
        assert.equal(error, fakeError)
    }
})

test.run()
