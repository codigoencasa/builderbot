import { promises as fsPromises } from 'fs'
import { existsSync } from 'fs'
import { join } from 'path'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { JsonFileDB } from '../src'
import type { HistoryEntry } from '../src/types'

const TEST_DIR = process.cwd()

// Helper para crear entradas de prueba
const createEntry = (from: string, keyword: string = 'test'): HistoryEntry => ({
    ref: `ref-${Date.now()}-${Math.random()}`,
    keyword,
    answer: `answer-${Date.now()}`,
    refSerialize: `serialize-${Date.now()}`,
    from,
    options: { timestamp: Date.now() },
})

// Helper para esperar
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// ============================================
// POV 1: CONCURRENCIA - Race Conditions
// ============================================

test('[CONCURRENCIA] Múltiples saves simultáneos no deben perder datos', async () => {
    const filename = 'test-concurrent-saves.json'
    const db = new JsonFileDB({ filename })
    const pathFile = join(TEST_DIR, filename)

    const NUM_CONCURRENT = 50
    const entries: HistoryEntry[] = []

    // Crear entradas únicas
    for (let i = 0; i < NUM_CONCURRENT; i++) {
        entries.push(createEntry(`user-${i}`, `keyword-${i}`))
    }

    // Guardar todas simultáneamente
    await Promise.all(entries.map((entry) => db.save(entry)))

    // Esperar a que se escriban
    await delay(100)

    // Verificar que todas se guardaron
    const fileContent = await fsPromises.readFile(pathFile, 'utf-8')
    const savedData = JSON.parse(fileContent)

    assert.is(savedData.length, NUM_CONCURRENT, `Deberían haber ${NUM_CONCURRENT} entradas, hay ${savedData.length}`)

    // Verificar que cada entrada está presente
    for (let i = 0; i < NUM_CONCURRENT; i++) {
        const found = savedData.find((e: HistoryEntry) => e.from === `user-${i}`)
        assert.ok(found, `Entrada user-${i} no encontrada`)
    }

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[CONCURRENCIA] Lecturas y escrituras simultáneas', async () => {
    const filename = 'test-concurrent-rw.json'
    const db = new JsonFileDB({ filename })
    const pathFile = join(TEST_DIR, filename)

    // Guardar algunas entradas iniciales
    for (let i = 0; i < 10; i++) {
        await db.save(createEntry(`initial-${i}`, 'initial'))
    }

    // Ejecutar lecturas y escrituras simultáneamente
    const operations: Promise<any>[] = []

    for (let i = 0; i < 20; i++) {
        // Escrituras
        operations.push(db.save(createEntry(`concurrent-${i}`, 'concurrent')))
        // Lecturas intercaladas
        operations.push(db.getPrevByNumber(`initial-${i % 10}`))
    }

    await Promise.all(operations)
    await delay(100)

    // Verificar integridad
    const fileContent = await fsPromises.readFile(pathFile, 'utf-8')
    const savedData = JSON.parse(fileContent)

    assert.is(savedData.length, 30, 'Deberían haber 30 entradas (10 iniciales + 20 concurrentes)')

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[CONCURRENCIA] Múltiples instancias del mismo archivo', async () => {
    const filename = 'test-multi-instance.json'
    const pathFile = join(TEST_DIR, filename)

    // Crear archivo inicial vacío
    await fsPromises.writeFile(pathFile, '[]', 'utf-8')

    const db1 = new JsonFileDB({ filename })
    const db2 = new JsonFileDB({ filename })

    // Esperar inicialización
    await delay(50)

    // Guardar desde ambas instancias
    await db1.save(createEntry('from-db1', 'db1'))
    await db2.save(createEntry('from-db2', 'db2'))

    await delay(100)

    // Nota: Con la implementación actual, cada instancia tiene su propio listHistory
    // Esto es un problema conocido - múltiples instancias no están sincronizadas
    // Este test documenta el comportamiento actual

    const fileContent = await fsPromises.readFile(pathFile, 'utf-8')
    const savedData = JSON.parse(fileContent)

    // El último en escribir "gana" - esto es un edge case conocido
    assert.ok(savedData.length >= 1, 'Al menos una entrada debería existir')

    // Cleanup
    await fsPromises.unlink(pathFile)
})

// ============================================
// POV 2: INTEGRIDAD DE DATOS
// ============================================

test('[INTEGRIDAD] Persistencia entre reinicios', async () => {
    const filename = 'test-persistence.json'
    const pathFile = join(TEST_DIR, filename)

    // Primera instancia - guardar datos
    const db1 = new JsonFileDB({ filename })
    await db1.save(createEntry('persist-user', 'persist-keyword'))
    await delay(50)

    // Segunda instancia - debería cargar datos existentes
    const db2 = new JsonFileDB({ filename })
    await delay(50)

    const result = await db2.getPrevByNumber('persist-user')
    assert.ok(result, 'Debería encontrar la entrada persistida')
    assert.is(result?.keyword, 'persist-keyword')

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[INTEGRIDAD] Recuperación de archivo corrupto', async () => {
    const filename = 'test-corrupt.json'
    const pathFile = join(TEST_DIR, filename)

    // Crear archivo corrupto
    await fsPromises.writeFile(pathFile, 'esto no es JSON válido {{{', 'utf-8')

    // Debería inicializarse sin errores
    const db = new JsonFileDB({ filename })
    await delay(50)

    // Debería poder guardar normalmente
    await db.save(createEntry('recovery-user', 'recovery'))
    await delay(50)

    // Verificar que el archivo ahora es válido
    const fileContent = await fsPromises.readFile(pathFile, 'utf-8')
    const savedData = JSON.parse(fileContent)

    assert.is(savedData.length, 1)
    assert.is(savedData[0].from, 'recovery-user')

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[INTEGRIDAD] Recuperación de archivo con objeto en vez de array', async () => {
    const filename = 'test-object-not-array.json'
    const pathFile = join(TEST_DIR, filename)

    // Crear archivo con objeto (no array)
    await fsPromises.writeFile(pathFile, '{"key": "value"}', 'utf-8')

    const db = new JsonFileDB({ filename })
    await delay(50)

    // Debería poder guardar
    await db.save(createEntry('object-user', 'object'))
    await delay(50)

    const fileContent = await fsPromises.readFile(pathFile, 'utf-8')
    const savedData = JSON.parse(fileContent)

    assert.ok(Array.isArray(savedData), 'Debería ser un array')
    assert.is(savedData.length, 1)

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[INTEGRIDAD] Archivo vacío', async () => {
    const filename = 'test-empty-file.json'
    const pathFile = join(TEST_DIR, filename)

    // Crear archivo vacío
    await fsPromises.writeFile(pathFile, '', 'utf-8')

    const db = new JsonFileDB({ filename })
    await delay(50)

    await db.save(createEntry('empty-user', 'empty'))
    await delay(50)

    const fileContent = await fsPromises.readFile(pathFile, 'utf-8')
    const savedData = JSON.parse(fileContent)

    assert.is(savedData.length, 1)

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[INTEGRIDAD] getPrevByNumber con múltiples entradas del mismo usuario', async () => {
    const filename = 'test-multiple-same-user.json'
    const db = new JsonFileDB({ filename })
    const pathFile = join(TEST_DIR, filename)

    // Guardar múltiples entradas del mismo usuario
    await db.save(createEntry('same-user', 'first'))
    await db.save(createEntry('same-user', 'second'))
    await db.save(createEntry('same-user', 'third'))
    await delay(50)

    // Debería retornar la última (más reciente)
    const result = await db.getPrevByNumber('same-user')
    assert.is(result?.keyword, 'third')

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[INTEGRIDAD] getPrevByNumber ignora entradas sin keyword', async () => {
    const filename = 'test-no-keyword.json'
    const db = new JsonFileDB({ filename })
    const pathFile = join(TEST_DIR, filename)

    // Entrada con keyword
    await db.save(createEntry('user-kw', 'has-keyword'))

    // Entrada sin keyword (simula mensaje intermedio)
    const noKeywordEntry = createEntry('user-kw', '')
    noKeywordEntry.keyword = ''
    await db.save(noKeywordEntry)

    await delay(50)

    const result = await db.getPrevByNumber('user-kw')
    assert.is(result?.keyword, 'has-keyword', 'Debería retornar la entrada con keyword')

    // Cleanup
    await fsPromises.unlink(pathFile)
})

// ============================================
// POV 3: PERFORMANCE Y CARGA
// ============================================

test('[PERFORMANCE] Carga alta - 500 entradas secuenciales', async () => {
    const filename = 'test-high-load-sequential.json'
    const db = new JsonFileDB({ filename })
    const pathFile = join(TEST_DIR, filename)

    const NUM_ENTRIES = 500
    const startTime = Date.now()

    for (let i = 0; i < NUM_ENTRIES; i++) {
        await db.save(createEntry(`load-user-${i}`, `load-${i}`))
    }

    const endTime = Date.now()
    const duration = endTime - startTime

    console.log(
        `    [PERF] ${NUM_ENTRIES} saves secuenciales: ${duration}ms (${(duration / NUM_ENTRIES).toFixed(2)}ms/op)`
    )

    // Verificar integridad
    const fileContent = await fsPromises.readFile(pathFile, 'utf-8')
    const savedData = JSON.parse(fileContent)

    assert.is(savedData.length, NUM_ENTRIES)

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[PERFORMANCE] Carga alta - 200 entradas paralelas', async () => {
    const filename = 'test-high-load-parallel.json'
    const db = new JsonFileDB({ filename })
    const pathFile = join(TEST_DIR, filename)

    const NUM_ENTRIES = 200
    const startTime = Date.now()

    const promises = []
    for (let i = 0; i < NUM_ENTRIES; i++) {
        promises.push(db.save(createEntry(`parallel-user-${i}`, `parallel-${i}`)))
    }

    await Promise.all(promises)
    await delay(200)

    const endTime = Date.now()
    const duration = endTime - startTime

    console.log(`    [PERF] ${NUM_ENTRIES} saves paralelos: ${duration}ms`)

    // Verificar integridad
    const fileContent = await fsPromises.readFile(pathFile, 'utf-8')
    const savedData = JSON.parse(fileContent)

    assert.is(savedData.length, NUM_ENTRIES, `Esperados ${NUM_ENTRIES}, encontrados ${savedData.length}`)

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[PERFORMANCE] Búsqueda en historial grande', async () => {
    const filename = 'test-search-large.json'
    const db = new JsonFileDB({ filename })
    const pathFile = join(TEST_DIR, filename)

    const NUM_ENTRIES = 1000

    // Crear entradas
    for (let i = 0; i < NUM_ENTRIES; i++) {
        await db.save(createEntry(`search-user-${i}`, `search-${i}`))
    }

    // Buscar usuario al final
    const startTime = Date.now()
    const result = await db.getPrevByNumber(`search-user-${NUM_ENTRIES - 1}`)
    const endTime = Date.now()

    console.log(`    [PERF] Búsqueda en ${NUM_ENTRIES} entradas: ${endTime - startTime}ms`)

    assert.ok(result)
    assert.is(result?.keyword, `search-${NUM_ENTRIES - 1}`)

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[PERFORMANCE] Inicialización con archivo grande existente', async () => {
    const filename = 'test-init-large.json'
    const pathFile = join(TEST_DIR, filename)

    // Crear archivo grande
    const largeData: HistoryEntry[] = []
    for (let i = 0; i < 5000; i++) {
        largeData.push(createEntry(`init-user-${i}`, `init-${i}`))
    }
    await fsPromises.writeFile(pathFile, JSON.stringify(largeData, null, 2), 'utf-8')

    // Medir tiempo de inicialización
    const startTime = Date.now()
    const db = new JsonFileDB({ filename })
    await delay(100) // Esperar init
    const endTime = Date.now()

    console.log(`    [PERF] Inicialización con 5000 entradas: ${endTime - startTime}ms`)

    // Verificar que cargó correctamente
    const result = await db.getPrevByNumber('init-user-4999')
    assert.ok(result)

    // Cleanup
    await fsPromises.unlink(pathFile)
})

// ============================================
// EDGE CASES ADICIONALES
// ============================================

test('[EDGE] Usuario no existente retorna undefined', async () => {
    const filename = 'test-user-not-found.json'
    const db = new JsonFileDB({ filename })
    const pathFile = join(TEST_DIR, filename)

    await db.save(createEntry('existing-user', 'exists'))
    await delay(50)

    const result = await db.getPrevByNumber('non-existing-user')
    assert.is(result, undefined)

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test('[EDGE] Operaciones antes de que init termine', async () => {
    const filename = 'test-pre-init.json'
    const pathFile = join(TEST_DIR, filename)

    // Crear db y hacer operación inmediatamente
    const db = new JsonFileDB({ filename })

    // Esto debería esperar a que init termine gracias a waitForInit
    await db.save(createEntry('pre-init-user', 'pre-init'))

    await delay(50)

    const result = await db.getPrevByNumber('pre-init-user')
    assert.ok(result, 'Debería encontrar la entrada aunque se guardó antes de init completo')

    // Cleanup
    if (existsSync(pathFile)) {
        await fsPromises.unlink(pathFile)
    }
})

test('[EDGE] Caracteres especiales en datos', async () => {
    const filename = 'test-special-chars.json'
    const db = new JsonFileDB({ filename })
    const pathFile = join(TEST_DIR, filename)

    const specialEntry = createEntry('user-special', 'keyword-special')
    specialEntry.answer = 'Texto con "comillas", \\barras\\, \nnewlines\n y émojis 🚀'
    specialEntry.options = { nested: { 'key with spaces': 'value' } }

    await db.save(specialEntry)
    await delay(50)

    // Verificar que se guardó correctamente
    const fileContent = await fsPromises.readFile(pathFile, 'utf-8')
    const savedData = JSON.parse(fileContent)

    assert.is(savedData[0].answer, specialEntry.answer)

    // Cleanup
    await fsPromises.unlink(pathFile)
})

test.run()
