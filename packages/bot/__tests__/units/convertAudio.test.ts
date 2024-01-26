import { join } from 'path'
import proxyquire from 'proxyquire'
import sinon from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

// Crear stubs para las funciones de ffmpeg
const ffmpegStub = sinon.stub()
const onStub = sinon.stub()
const outputStub = sinon.stub()
const runStub = sinon.stub()

// Configurar los stubs para encadenar métodos
ffmpegStub.returns({
    audioCodec: ffmpegStub,
    audioBitrate: ffmpegStub,
    format: ffmpegStub,
    output: outputStub.returns({
        on: onStub.returns({
            run: runStub,
        }),
    }),
})

// Reemplazar el módulo 'fluent-ffmpeg' con los stubs
const { convertAudio } = proxyquire('../../src/utils/convertAudio', {
    'fluent-ffmpeg': ffmpegStub,
})

// Restablecer los stubs antes de cada prueba
test.before.each(() => {
    ffmpegStub.resetHistory()
    onStub.resetHistory()
    outputStub.resetHistory()
    runStub.resetHistory()
})

test('convertAudio - throws error if filePath is empty', async () => {
    try {
        await convertAudio('')
        assert.unreachable('convertAudio should throw an error when filePath is empty')
    } catch (err) {
        assert.instance(err, Error)
        assert.is(err.message, 'filePath is required')
    }
})

test('convertAudio - converts to opus by default', async () => {
    const fakePath = join(process.cwd(), '__mock__', 'test.mp3')
    // Simular el evento 'end' de ffmpeg
    onStub.callsFake((event, callback) => {
        if (event === 'end') {
            callback()
        }
        return { run: runStub }
    })

    const result = await convertAudio(fakePath)
    assert.ok(result.includes('test.opus'))
})

test.run()
