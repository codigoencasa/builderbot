import { promises as fsPromises } from 'fs'
import { join } from 'path'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { JsonFileDB } from '../src'
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
// DEBOUNCE TESTS
// ============================================

test('[DEBOUNCE] Con debounce activado agrupa escrituras', async () => {
    const filename = 'test-debounce-grouped.json'
    const db = new JsonFileDB({ filename, debounceTime: 50 }) // 50ms debounce
    const pathFile = join(TEST_DIR, filename)

    const NUM_WRITES = 20
    const startTime = Date.now()

    // Disparar muchas escrituras rápidas
    const promises: Promise<void>[] = []
    for (let i = 0; i < NUM_WRITES; i++) {
        promises.push(db.save(createEntry(`debounce-${i}`, `kw-${i}`)))
    }

    // Esperar todas
    await Promise.all(promises)
    await delay(100) // Esperar que debounce termine

    const endTime = Date.now()

    // Verificar que todas se guardaron
    const fileContent = await fsPromises.readFile(pathFile, 'utf-8')
    const savedData = JSON.parse(fileContent)

    console.log(`    [DEBOUNCE] ${NUM_WRITES} writes con debounce=50ms: ${endTime - startTime}ms`)

    assert.is(savedData.length, NUM_WRITES, `Se esperaban ${NUM_WRITES} entradas`)

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[DEBOUNCE] Sin debounce es más lento pero igualmente seguro', async () => {
    const filename = 'test-no-debounce.json'
    const db = new JsonFileDB({ filename, debounceTime: 0 })
    const pathFile = join(TEST_DIR, filename)

    const NUM_WRITES = 20
    const startTime = Date.now()

    const promises: Promise<void>[] = []
    for (let i = 0; i < NUM_WRITES; i++) {
        promises.push(db.save(createEntry(`no-debounce-${i}`, `kw-${i}`)))
    }

    await Promise.all(promises)
    await delay(50)

    const endTime = Date.now()

    const fileContent = await fsPromises.readFile(pathFile, 'utf-8')
    const savedData = JSON.parse(fileContent)

    console.log(`    [DEBOUNCE] ${NUM_WRITES} writes sin debounce: ${endTime - startTime}ms`)

    assert.is(savedData.length, NUM_WRITES)

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[DEBOUNCE] Comparación de performance con y sin debounce', async () => {
    const NUM_WRITES = 50

    // Test sin debounce
    const filenameNoDebounce = 'test-perf-no-debounce.json'
    const dbNoDebounce = new JsonFileDB({ filename: filenameNoDebounce, debounceTime: 0 })
    const pathNoDebounce = join(TEST_DIR, filenameNoDebounce)

    const startNoDebounce = Date.now()
    const promisesNo: Promise<void>[] = []
    for (let i = 0; i < NUM_WRITES; i++) {
        promisesNo.push(dbNoDebounce.save(createEntry(`perf-${i}`, `kw-${i}`)))
    }
    await Promise.all(promisesNo)
    await delay(50)
    const endNoDebounce = Date.now()

    // Test con debounce
    const filenameDebounce = 'test-perf-debounce.json'
    const dbDebounce = new JsonFileDB({ filename: filenameDebounce, debounceTime: 30 })
    const pathDebounce = join(TEST_DIR, filenameDebounce)

    const startDebounce = Date.now()
    const promisesYes: Promise<void>[] = []
    for (let i = 0; i < NUM_WRITES; i++) {
        promisesYes.push(dbDebounce.save(createEntry(`perf-${i}`, `kw-${i}`)))
    }
    await Promise.all(promisesYes)
    await delay(100)
    const endDebounce = Date.now()

    const timeNoDebounce = endNoDebounce - startNoDebounce
    const timeDebounce = endDebounce - startDebounce

    console.log(`    [DEBOUNCE] Comparación ${NUM_WRITES} writes:`)
    console.log(`        Sin debounce: ${timeNoDebounce}ms`)
    console.log(`        Con debounce (30ms): ${timeDebounce}ms`)

    // Verificar integridad
    const dataNo = JSON.parse(await fsPromises.readFile(pathNoDebounce, 'utf-8'))
    const dataYes = JSON.parse(await fsPromises.readFile(pathDebounce, 'utf-8'))

    assert.is(dataNo.length, NUM_WRITES)
    assert.is(dataYes.length, NUM_WRITES)

    // Cleanup
    await fsPromises.unlink(pathNoDebounce)
    await fsPromises.unlink(pathDebounce)
})

test('[DEBOUNCE] Lectura funciona durante debounce pendiente', async () => {
    const filename = 'test-read-during-debounce.json'
    const db = new JsonFileDB({ filename, debounceTime: 100 })
    const pathFile = join(TEST_DIR, filename)

    // Guardar entrada
    await db.save(createEntry('read-user', 'read-kw'))

    // Inmediatamente leer (debounce aún pendiente)
    const result = await db.getPrevByNumber('read-user')

    // Debería encontrar desde memoria aunque el archivo no esté actualizado aún
    assert.ok(result)
    assert.is(result?.keyword, 'read-kw')

    await delay(150) // Esperar debounce

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[DEBOUNCE] Múltiples debounce consecutivos no pierden datos', async () => {
    const filename = 'test-multiple-debounce.json'
    const db = new JsonFileDB({ filename, debounceTime: 20 })
    const pathFile = join(TEST_DIR, filename)

    // Ronda 1
    for (let i = 0; i < 5; i++) {
        await db.save(createEntry(`round1-${i}`, `r1-${i}`))
    }
    await delay(30)

    // Ronda 2
    for (let i = 0; i < 5; i++) {
        await db.save(createEntry(`round2-${i}`, `r2-${i}`))
    }
    await delay(30)

    // Ronda 3
    for (let i = 0; i < 5; i++) {
        await db.save(createEntry(`round3-${i}`, `r3-${i}`))
    }
    await delay(50)

    const fileContent = await fsPromises.readFile(pathFile, 'utf-8')
    const savedData = JSON.parse(fileContent)

    assert.is(savedData.length, 15, 'Deberían haber 15 entradas (5 x 3 rondas)')

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test.run()
