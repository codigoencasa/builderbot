import { createHash } from 'crypto'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { convertAudio } from '../../src/utils/convertAudio'

/**
 * `convertAudio` escribe el resultado junto al fichero de entrada, así que este
 * test trabaja sobre una copia en un directorio temporal.
 *
 * Antes convertía `__mock__/test.mp3` en sitio, lo que sobrescribía el fixture
 * commiteado `__mock__/test.ogg` (usado por `provider-baileys/scripts/live-smoke.cjs`)
 * en cada corrida de tests y dejaba el árbol de trabajo sucio permanentemente.
 */
const MOCK_DIR = join(process.cwd(), '__mock__')
const INPUT_FIXTURE = join(MOCK_DIR, 'test.mp3')
const COMMITTED_OUTPUT = join(MOCK_DIR, 'test.ogg')

const hashOf = (file: string): string | null =>
    existsSync(file) ? createHash('sha256').update(readFileSync(file)).digest('hex') : null

/** Copia el fixture a un directorio temporal, ejecuta el caso y limpia siempre. */
const withTempInput = async (run: (inputPath: string, dir: string) => Promise<void>): Promise<void> => {
    const dir = mkdtempSync(join(tmpdir(), 'builderbot-convert-audio-'))
    const inputPath = join(dir, 'test.mp3')
    copyFileSync(INPUT_FIXTURE, inputPath)
    try {
        await run(inputPath, dir)
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
}

test('convertAudio - throws error if filePath is empty', async () => {
    try {
        await convertAudio('')
        assert.unreachable('convertAudio should throw an error when filePath is empty')
    } catch (err) {
        assert.instance(err, Error)
        assert.is(err.message, 'filePath is required')
    }
})

test('convertAudio - converts to ogg by default', async () => {
    await withTempInput(async (inputPath, dir) => {
        const result = await convertAudio(inputPath)

        assert.is(result, join(dir, 'test.ogg'))
        assert.ok(existsSync(result), 'the converted file should exist')
    })
})

test('convertAudio - honours an explicit format', async () => {
    // Se usa 'mp4' y no 'mp3' a propósito: la entrada del fixture ya se llama
    // `test.mp3`, así que convertir a mp3 daría la misma ruta de salida y ffmpeg
    // se negaría a editar el fichero en sitio.
    await withTempInput(async (inputPath, dir) => {
        const result = await convertAudio(inputPath, 'mp4')

        assert.is(result, join(dir, 'test.mp4'))
        assert.ok(existsSync(result), 'the converted file should exist')
    })
})

test('convertAudio - never writes over the committed fixture', async () => {
    const before = hashOf(COMMITTED_OUTPUT)

    await withTempInput(async (inputPath) => {
        await convertAudio(inputPath)
    })

    assert.is(hashOf(COMMITTED_OUTPUT), before, 'the committed __mock__/test.ogg must not be modified')
})

test.run()
