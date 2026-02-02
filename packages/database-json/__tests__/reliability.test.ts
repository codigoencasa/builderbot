import { promises as fsPromises } from 'fs'
import { existsSync } from 'fs'
import { join } from 'path'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { JsonFileDB } from '../src/index'
import type { HistoryEntry } from '../src/types'

const TEST_DIR = process.cwd()

const createEntry = (from: string, keyword: string = 'test'): HistoryEntry => ({
    ref: `ref-${Date.now()}-${Math.random()}`,
    keyword,
    answer: `answer-${Date.now()}`,
    refSerialize: `serialize-${Date.now()}`,
    from,
    options: { timestamp: Date.now() },
})

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// ============================================
// RELIABILITY TESTS - Temp file recovery
// ============================================

test('[RELIABILITY] Recupera datos de archivo temporal tras crash simulado', async () => {
    const filename = 'test-reliability-temp-recovery.json'
    const pathFile = join(TEST_DIR, filename)
    const tempPath = `${pathFile}.tmp`

    // Simular estado post-crash: archivo principal con 2 entradas, temp con 3
    const mainData = [createEntry('user-1', 'kw-1'), createEntry('user-2', 'kw-2')]
    const tempData = [...mainData, createEntry('user-3', 'kw-3')]

    await fsPromises.writeFile(pathFile, JSON.stringify(mainData), 'utf-8')
    await fsPromises.writeFile(tempPath, JSON.stringify(tempData), 'utf-8')

    // Crear nueva instancia - debería recuperar del temp
    const db = new JsonFileDB({ filename })
    await delay(100)

    const result = await db.getPrevByNumber('user-3')
    assert.ok(result, 'Debería encontrar user-3 recuperado del temp file')
    assert.is(result?.keyword, 'kw-3')

    // Temp file debería haber sido eliminado (renombrado a principal)
    assert.not.ok(existsSync(tempPath), 'Temp file debería haberse convertido en el principal')

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[RELIABILITY] No recupera temp si tiene menos datos que principal', async () => {
    const filename = 'test-reliability-no-recovery.json'
    const pathFile = join(TEST_DIR, filename)
    const tempPath = `${pathFile}.tmp`

    // Archivo principal con 3 entradas, temp con 1 (corrupto/parcial)
    const mainData = [createEntry('user-1', 'kw-1'), createEntry('user-2', 'kw-2'), createEntry('user-3', 'kw-3')]
    const tempData = [createEntry('old-user', 'old-kw')]

    await fsPromises.writeFile(pathFile, JSON.stringify(mainData), 'utf-8')
    await fsPromises.writeFile(tempPath, JSON.stringify(tempData), 'utf-8')

    const db = new JsonFileDB({ filename })
    await delay(100)

    // Debería usar los datos del archivo principal
    const result = await db.getPrevByNumber('user-3')
    assert.ok(result, 'Debería tener user-3 del archivo principal')

    // Temp debería haber sido limpiado
    assert.not.ok(existsSync(tempPath), 'Temp file corrupto debería eliminarse')

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[RELIABILITY] Temp file corrupto se descarta y usa principal', async () => {
    const filename = 'test-reliability-corrupt-temp.json'
    const pathFile = join(TEST_DIR, filename)
    const tempPath = `${pathFile}.tmp`

    const mainData = [createEntry('user-1', 'kw-1')]
    await fsPromises.writeFile(pathFile, JSON.stringify(mainData), 'utf-8')
    await fsPromises.writeFile(tempPath, 'esto no es JSON válido {{{', 'utf-8')

    const db = new JsonFileDB({ filename })
    await delay(100)

    const result = await db.getPrevByNumber('user-1')
    assert.ok(result, 'Debería usar datos del archivo principal')

    // Cleanup
    await fsPromises.unlink(pathFile)
    if (existsSync(tempPath)) await fsPromises.unlink(tempPath)
})

// ============================================
// RELIABILITY TESTS - File locking
// ============================================

test('[RELIABILITY] Lock file se limpia después de escritura', async () => {
    const filename = 'test-reliability-lock-cleanup.json'
    const pathFile = join(TEST_DIR, filename)
    const lockPath = `${pathFile}.lock`

    const db = new JsonFileDB({ filename })
    await db.save(createEntry('lock-user', 'lock-kw'))
    await delay(100)

    // Lock file no debería existir después de la escritura
    assert.not.ok(existsSync(lockPath), 'Lock file debería limpiarse después de escritura')

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[RELIABILITY] Stale lock file se elimina y permite escritura', async () => {
    const filename = 'test-reliability-stale-lock.json'
    const pathFile = join(TEST_DIR, filename)
    const lockPath = `${pathFile}.lock`

    // Crear un lock file stale (timestamp antiguo)
    const staleLock = JSON.stringify({ pid: 99999, ts: Date.now() - 20000 })
    await fsPromises.writeFile(lockPath, staleLock, 'utf-8')

    const db = new JsonFileDB({ filename })
    await db.save(createEntry('stale-user', 'stale-kw'))
    await delay(100)

    // Debería haber podido escribir a pesar del lock stale
    const fileContent = await fsPromises.readFile(pathFile, 'utf-8')
    const savedData = JSON.parse(fileContent)
    assert.is(savedData.length, 1)
    assert.is(savedData[0].from, 'stale-user')

    // Cleanup
    await fsPromises.unlink(pathFile)
    if (existsSync(lockPath)) await fsPromises.unlink(lockPath)
})

// ============================================
// RELIABILITY TESTS - Write integrity
// ============================================

test('[RELIABILITY] Datos escritos son válidos JSON y tienen longitud correcta', async () => {
    const filename = 'test-reliability-write-integrity.json'
    const pathFile = join(TEST_DIR, filename)

    const db = new JsonFileDB({ filename })
    const NUM = 25

    for (let i = 0; i < NUM; i++) {
        await db.save(createEntry(`integrity-${i}`, `kw-${i}`))
    }
    await delay(100)

    const fileContent = await fsPromises.readFile(pathFile, 'utf-8')
    const savedData = JSON.parse(fileContent)

    assert.is(savedData.length, NUM, `Deberían haber ${NUM} entradas`)

    // Verificar que cada entrada tiene los campos necesarios
    for (const entry of savedData) {
        assert.ok(entry.ref, 'Cada entrada debe tener ref')
        assert.ok(entry.from, 'Cada entrada debe tener from')
        assert.type(entry.keyword, 'string', 'keyword debe ser string')
    }

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[RELIABILITY] Escrituras paralelas masivas mantienen integridad', async () => {
    const filename = 'test-reliability-parallel-integrity.json'
    const pathFile = join(TEST_DIR, filename)

    const db = new JsonFileDB({ filename })
    const NUM = 100

    const promises: Promise<void>[] = []
    for (let i = 0; i < NUM; i++) {
        promises.push(db.save(createEntry(`parallel-${i}`, `kw-${i}`)))
    }

    await Promise.all(promises)
    await delay(300)

    const fileContent = await fsPromises.readFile(pathFile, 'utf-8')

    // El archivo debe ser JSON válido
    let savedData: any
    try {
        savedData = JSON.parse(fileContent)
    } catch {
        assert.unreachable('El archivo debería ser JSON válido después de escrituras paralelas')
    }

    assert.ok(Array.isArray(savedData), 'Debería ser un array')
    assert.is(savedData.length, NUM, `Deberían haber ${NUM} entradas`)

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[RELIABILITY] Persistencia entre reinicios con nueva implementación', async () => {
    const filename = 'test-reliability-restart-persist.json'
    const pathFile = join(TEST_DIR, filename)

    // Primera instancia
    const db1 = new JsonFileDB({ filename })
    await db1.save(createEntry('persist-user-1', 'persist-1'))
    await db1.save(createEntry('persist-user-2', 'persist-2'))
    await delay(100)

    // Verificar que el archivo tiene datos compactos (sin pretty-print)
    const rawContent = await fsPromises.readFile(pathFile, 'utf-8')
    assert.not.ok(rawContent.includes('\n  '), 'Debería usar JSON compacto para mejor performance')

    // Segunda instancia (simula reinicio)
    const db2 = new JsonFileDB({ filename })
    await delay(100)

    const result1 = await db2.getPrevByNumber('persist-user-1')
    const result2 = await db2.getPrevByNumber('persist-user-2')
    assert.ok(result1, 'Debería persistir user-1')
    assert.ok(result2, 'Debería persistir user-2')

    // Cleanup
    await fsPromises.unlink(pathFile)
})

// ============================================
// RELIABILITY TESTS - Error handling
// ============================================

test('[RELIABILITY] No deja archivos temporales huérfanos en operación normal', async () => {
    const filename = 'test-reliability-no-orphans.json'
    const pathFile = join(TEST_DIR, filename)
    const tempPath = `${pathFile}.tmp`
    const lockPath = `${pathFile}.lock`

    const db = new JsonFileDB({ filename })

    for (let i = 0; i < 10; i++) {
        await db.save(createEntry(`orphan-${i}`, `kw-${i}`))
    }
    await delay(100)

    assert.not.ok(existsSync(tempPath), 'No debería quedar archivo temporal')
    assert.not.ok(existsSync(lockPath), 'No debería quedar lock file')

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test.run()
