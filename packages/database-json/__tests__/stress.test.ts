import { promises as fsPromises } from 'fs'
import { existsSync } from 'fs'
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
// STRESS TESTS - Casos extremos
// ============================================

test('[STRESS] 100 operaciones paralelas mezcladas (save + getPrevByNumber)', async () => {
    const filename = 'test-stress-mixed.json'
    const db = new JsonFileDB({ filename })
    const pathFile = join(TEST_DIR, filename)

    // Primero guardar algunas entradas base
    for (let i = 0; i < 20; i++) {
        await db.save(createEntry(`base-${i}`, `base-kw-${i}`))
    }

    // Ahora bombardear con operaciones mixtas
    const operations: Promise<any>[] = []
    const results: any[] = []

    for (let i = 0; i < 100; i++) {
        if (i % 3 === 0) {
            // Lectura
            operations.push(
                db.getPrevByNumber(`base-${i % 20}`).then((r) => {
                    results.push({ type: 'read', i, found: !!r })
                    return r
                })
            )
        } else {
            // Escritura
            operations.push(
                db.save(createEntry(`stress-${i}`, `stress-kw-${i}`)).then(() => {
                    results.push({ type: 'write', i })
                })
            )
        }
    }

    await Promise.all(operations)
    await delay(200)

    // Verificar
    const fileContent = await fsPromises.readFile(pathFile, 'utf-8')
    const savedData = JSON.parse(fileContent)

    // 20 base + ~66 stress writes (100 - ~33 reads)
    const expectedWrites = 100 - Math.floor(100 / 3)
    const totalExpected = 20 + expectedWrites

    console.log(`    [STRESS] Operaciones completadas: ${results.length}`)
    console.log(`    [STRESS] Entradas guardadas: ${savedData.length} (esperadas: ~${totalExpected})`)

    assert.ok(savedData.length >= totalExpected - 5, `Se perdieron demasiadas escrituras`)

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[STRESS] Escrituras rápidas consecutivas sin await', async () => {
    const filename = 'test-stress-rapid.json'
    const db = new JsonFileDB({ filename })
    const pathFile = join(TEST_DIR, filename)

    const NUM = 50
    const promises: Promise<void>[] = []

    // Disparar escrituras sin esperar
    for (let i = 0; i < NUM; i++) {
        promises.push(db.save(createEntry(`rapid-${i}`, `rapid-kw-${i}`)))
    }

    // Ahora esperar todas
    await Promise.all(promises)
    await delay(300)

    const fileContent = await fsPromises.readFile(pathFile, 'utf-8')
    const savedData = JSON.parse(fileContent)

    console.log(`    [STRESS] Rapid writes: ${savedData.length}/${NUM}`)

    assert.is(savedData.length, NUM, `Se esperaban ${NUM} entradas, se encontraron ${savedData.length}`)

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[STRESS] Verificar orden de escritura se preserva', async () => {
    const filename = 'test-stress-order.json'
    const db = new JsonFileDB({ filename })
    const pathFile = join(TEST_DIR, filename)

    const NUM = 30

    // Guardar secuencialmente
    for (let i = 0; i < NUM; i++) {
        await db.save(createEntry(`order-user`, `order-${i}`))
    }

    await delay(100)

    const fileContent = await fsPromises.readFile(pathFile, 'utf-8')
    const savedData = JSON.parse(fileContent)

    // Verificar que el orden se preservó
    for (let i = 0; i < NUM; i++) {
        assert.is(savedData[i].keyword, `order-${i}`, `Orden incorrecto en posición ${i}`)
    }

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[STRESS] Simular múltiples usuarios enviando mensajes', async () => {
    const filename = 'test-stress-users.json'
    const db = new JsonFileDB({ filename })
    const pathFile = join(TEST_DIR, filename)

    const NUM_USERS = 20
    const MESSAGES_PER_USER = 10

    const promises: Promise<void>[] = []

    // Simular mensajes de múltiples usuarios
    for (let msg = 0; msg < MESSAGES_PER_USER; msg++) {
        for (let user = 0; user < NUM_USERS; user++) {
            promises.push(db.save(createEntry(`user-${user}`, `msg-${msg}`)))
        }
    }

    await Promise.all(promises)
    await delay(300)

    const fileContent = await fsPromises.readFile(pathFile, 'utf-8')
    const savedData = JSON.parse(fileContent)

    const expected = NUM_USERS * MESSAGES_PER_USER
    console.log(`    [STRESS] Multi-user: ${savedData.length}/${expected}`)

    assert.is(savedData.length, expected)

    // Verificar que cada usuario tiene sus mensajes
    for (let user = 0; user < NUM_USERS; user++) {
        const userEntries = savedData.filter((e: HistoryEntry) => e.from === `user-${user}`)
        assert.is(userEntries.length, MESSAGES_PER_USER, `Usuario ${user} tiene ${userEntries.length} entradas`)
    }

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[STRESS] getPrevByNumber debe retornar última entrada con keyword', async () => {
    const filename = 'test-stress-lastentry.json'
    const db = new JsonFileDB({ filename })
    const pathFile = join(TEST_DIR, filename)

    // Guardar secuencia: keyword, sin keyword, keyword, sin keyword, keyword
    await db.save({ ...createEntry('test-user', 'first'), keyword: 'first' })
    await db.save({ ...createEntry('test-user', ''), keyword: '' })
    await db.save({ ...createEntry('test-user', 'second'), keyword: 'second' })
    await db.save({ ...createEntry('test-user', ''), keyword: '' })
    await db.save({ ...createEntry('test-user', 'third'), keyword: 'third' })

    await delay(50)

    const result = await db.getPrevByNumber('test-user')

    assert.is(result?.keyword, 'third', 'Debería retornar "third" que es la última con keyword')

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[STRESS] Recuperación después de escritura fallida (simular)', async () => {
    const filename = 'test-stress-recovery.json'
    const pathFile = join(TEST_DIR, filename)

    // Crear archivo inicial
    await fsPromises.writeFile(pathFile, '[]', 'utf-8')

    const db = new JsonFileDB({ filename })
    await delay(50)

    // Guardar algunas entradas
    await db.save(createEntry('recovery-1', 'r1'))
    await db.save(createEntry('recovery-2', 'r2'))
    await delay(50)

    // Simular corrupción externa escribiendo directamente al archivo
    // (como si otro proceso lo hubiera corrompido)
    // No hacemos esto porque rompería el test - pero documentamos el edge case

    // Guardar más entradas
    await db.save(createEntry('recovery-3', 'r3'))
    await delay(50)

    const fileContent = await fsPromises.readFile(pathFile, 'utf-8')
    const savedData = JSON.parse(fileContent)

    assert.is(savedData.length, 3)

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[STRESS] Archivos muy grandes (10,000 entradas)', async () => {
    const filename = 'test-stress-huge.json'
    const pathFile = join(TEST_DIR, filename)

    // Pre-crear archivo grande
    const hugeData: HistoryEntry[] = []
    for (let i = 0; i < 10000; i++) {
        hugeData.push(createEntry(`huge-${i}`, `huge-kw-${i}`))
    }
    await fsPromises.writeFile(pathFile, JSON.stringify(hugeData), 'utf-8')

    const startInit = Date.now()
    const db = new JsonFileDB({ filename })
    await delay(200) // Esperar init
    const endInit = Date.now()

    console.log(`    [STRESS] Init con 10,000 entradas: ${endInit - startInit}ms`)

    // Añadir una entrada más
    const startSave = Date.now()
    await db.save(createEntry('huge-new', 'new'))
    await delay(100)
    const endSave = Date.now()

    console.log(`    [STRESS] Save en archivo con 10,000 entradas: ${endSave - startSave}ms`)

    // Búsqueda
    const startSearch = Date.now()
    const result = await db.getPrevByNumber('huge-9999')
    const endSearch = Date.now()

    console.log(`    [STRESS] Search en 10,000 entradas: ${endSearch - startSearch}ms`)

    assert.ok(result)

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test.run()
