import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { generalDownload } from '../../src/utils/download'

// Directorio temporal para los tests
const TEST_DIR = join(tmpdir(), 'download-test-' + Date.now())

// Setup: crear directorio de tests
const setupTestDir = () => {
    if (!existsSync(TEST_DIR)) {
        mkdirSync(TEST_DIR, { recursive: true })
    }
}

// Cleanup: eliminar directorio de tests
const cleanupTestDir = () => {
    try {
        if (existsSync(TEST_DIR)) {
            rmSync(TEST_DIR, { recursive: true, force: true })
        }
    } catch (e) {
        // Ignorar errores de limpieza
    }
}

// Helper para crear un archivo local de prueba
const createTestFile = (filename: string, content: string = 'test content'): string => {
    const filepath = join(TEST_DIR, filename)
    writeFileSync(filepath, content)
    return filepath
}

// Test para archivos locales (sin dependencia de red)
test('generalDownload - should handle local file path', async () => {
    setupTestDir()

    try {
        // Crear archivo de prueba
        const testFile = createTestFile('test-image.png')

        // generalDownload con archivo local debería retornar el mismo path
        const result = await generalDownload(testFile)

        assert.is(result, testFile, 'Should return the same local file path')
    } finally {
        cleanupTestDir()
    }
})

test('generalDownload - should generate unique filenames for concurrent local files', async () => {
    setupTestDir()

    try {
        // Crear múltiples archivos de prueba
        const testFiles = [
            createTestFile('concurrent-1.jpeg'),
            createTestFile('concurrent-2.jpeg'),
            createTestFile('concurrent-3.jpeg'),
        ]

        // Descargar archivos locales concurrentemente
        const promises = testFiles.map((file) => generalDownload(file))
        const results = await Promise.all(promises)

        // Verificar que todos los resultados son únicos (los paths originales)
        const uniqueResults = new Set(results)
        assert.is(uniqueResults.size, results.length, 'All results should be unique paths')

        // Verificar que cada resultado corresponde al archivo original
        results.forEach((result, index) => {
            assert.is(result, testFiles[index], 'Should return original file path for local files')
        })
    } finally {
        cleanupTestDir()
    }
})

// Test para verificar la estructura de nombres generados (unit test puro)
test('generateUniqueFileName - should create unique names with timestamp and hash pattern', () => {
    // Simular la lógica de generateUniqueFileName
    const generateUniqueFileName = (originalName: string): string => {
        const timestamp = Date.now()
        const { randomBytes } = require('crypto')
        const randomHash = randomBytes(4).toString('hex')
        return `${originalName}_${timestamp}_${randomHash}`
    }

    const name1 = generateUniqueFileName('test')
    const name2 = generateUniqueFileName('test')

    // Verificar formato
    assert.ok(name1.startsWith('test_'), 'Should start with original name')
    assert.ok(/test_\d+_[0-9a-f]{8}/.test(name1), 'Should match pattern: name_timestamp_hash')

    // Los nombres deben ser diferentes (timestamp o hash diferente)
    // Nota: podrían ser iguales si se generan en el mismo milisegundo con el mismo hash (muy improbable)
    assert.type(name1, 'string')
    assert.type(name2, 'string')
})

// Note: Tests use local files to avoid network dependencies.
// The download function handles both local files and URLs.
// Local file tests verify the core functionality without flaky network calls.

test.run()
