import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { existsSync, unlinkSync, mkdirSync, rmdirSync } from 'fs'
import { join } from 'path'
import {
    PersistenceManager,
    getDefaultPersistence,
    resetDefaultPersistence,
    type SerializableBotConfig,
    type PersistenceConfig,
} from '../src/persistence'

// Test directory for persistence tests
const TEST_DIR = join(__dirname, '../.test-persistence')
const TEST_FILE = 'test-bots.json'

// Helper to clean up test files
const cleanup = () => {
    try {
        const filePath = join(TEST_DIR, TEST_FILE)
        if (existsSync(filePath)) {
            unlinkSync(filePath)
        }
        if (existsSync(TEST_DIR)) {
            rmdirSync(TEST_DIR, { recursive: true })
        }
    } catch {
        // Ignore errors during cleanup
    }
}

// ============ Constructor Tests ============

test('PersistenceManager - constructor with default config', () => {
    cleanup()
    resetDefaultPersistence()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    assert.ok(manager)
    assert.is(manager.count(), 0)

    cleanup()
})

test('PersistenceManager - constructor with custom config', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: 'custom.json',
        autoSave: false,
    })

    assert.ok(manager)
    assert.is(manager.getFilePath(), join(TEST_DIR, 'custom.json'))

    cleanup()
})

test('PersistenceManager - constructor loads existing data', () => {
    cleanup()

    // Create manager and save data
    const manager1 = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })
    manager1.save('tenant1', { tenantId: 'tenant1', flowIds: ['flow1'] })

    // Create new manager that should load existing data
    const manager2 = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    assert.is(manager2.count(), 1)
    assert.ok(manager2.has('tenant1'))

    cleanup()
})

// ============ save() Tests ============

test('PersistenceManager - save stores configuration', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    manager.save('tenant1', {
        tenantId: 'tenant1',
        name: 'Test Bot',
        flowIds: ['flow1', 'flow2'],
        port: 3000,
    })

    assert.is(manager.count(), 1)

    const saved = manager.get('tenant1')
    assert.ok(saved)
    assert.is(saved?.tenantId, 'tenant1')
    assert.is(saved?.name, 'Test Bot')
    assert.equal(saved?.flowIds, ['flow1', 'flow2'])
    assert.is(saved?.port, 3000)

    cleanup()
})

test('PersistenceManager - save with provider and database class names', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    manager.save('tenant1', { tenantId: 'tenant1', flowIds: ['flow1'] }, 'BaileysProvider', 'MemoryDB')

    const saved = manager.get('tenant1')
    assert.is(saved?.providerClassName, 'BaileysProvider')
    assert.is(saved?.databaseClassName, 'MemoryDB')

    cleanup()
})

test('PersistenceManager - save with all options', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    manager.save(
        'full-config',
        {
            tenantId: 'full-config',
            name: 'Full Config Bot',
            flowIds: ['flow1'],
            port: 3001,
            providerOptions: { timeout: 5000 },
            databaseOptions: { path: './db' },
        },
        'CustomProvider',
        'CustomDB'
    )

    const saved = manager.get('full-config')
    assert.is(saved?.tenantId, 'full-config')
    assert.is(saved?.name, 'Full Config Bot')
    assert.is(saved?.port, 3001)
    assert.equal(saved?.providerOptions, { timeout: 5000 })
    assert.equal(saved?.databaseOptions, { path: './db' })
    assert.is(saved?.providerClassName, 'CustomProvider')
    assert.is(saved?.databaseClassName, 'CustomDB')

    cleanup()
})

test('PersistenceManager - save overwrites existing', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    manager.save('tenant1', { tenantId: 'tenant1', name: 'First', flowIds: ['flow1'] })
    manager.save('tenant1', { tenantId: 'tenant1', name: 'Second', flowIds: ['flow2'] })

    assert.is(manager.count(), 1)
    assert.is(manager.get('tenant1')?.name, 'Second')

    cleanup()
})

test('PersistenceManager - save with autoSave disabled does not persist', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
        autoSave: false,
    })

    manager.save('tenant1', { tenantId: 'tenant1', flowIds: ['flow1'] })

    // Data should be in memory but not persisted
    assert.is(manager.count(), 1)

    // File should not exist
    assert.not.ok(existsSync(join(TEST_DIR, TEST_FILE)))

    cleanup()
})

test('PersistenceManager - save adds createdAt timestamp', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    const before = new Date().toISOString()
    manager.save('tenant1', { tenantId: 'tenant1', flowIds: ['flow1'] })
    const after = new Date().toISOString()

    const saved = manager.get('tenant1')
    assert.ok(saved?.createdAt)
    assert.ok(saved!.createdAt >= before)
    assert.ok(saved!.createdAt <= after)

    cleanup()
})

// ============ remove() Tests ============

test('PersistenceManager - remove deletes configuration', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    manager.save('tenant1', { tenantId: 'tenant1', flowIds: ['flow1'] })
    assert.is(manager.count(), 1)

    const result = manager.remove('tenant1')

    assert.is(result, true)
    assert.is(manager.count(), 0)
    assert.not.ok(manager.has('tenant1'))

    cleanup()
})

test('PersistenceManager - remove returns false for non-existent', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    const result = manager.remove('non-existent')

    assert.is(result, false)

    cleanup()
})

test('PersistenceManager - remove with autoSave persists changes', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
        autoSave: true,
    })

    manager.save('tenant1', { tenantId: 'tenant1', flowIds: ['flow1'] })
    manager.remove('tenant1')

    // Reload and verify
    const manager2 = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    assert.is(manager2.count(), 0)

    cleanup()
})

// ============ get() Tests ============

test('PersistenceManager - get returns configuration', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    manager.save('tenant1', { tenantId: 'tenant1', name: 'Test', flowIds: ['flow1'] })

    const config = manager.get('tenant1')

    assert.ok(config)
    assert.is(config?.tenantId, 'tenant1')
    assert.is(config?.name, 'Test')

    cleanup()
})

test('PersistenceManager - get returns undefined for non-existent', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    const config = manager.get('non-existent')

    assert.is(config, undefined)

    cleanup()
})

// ============ getAll() Tests ============

test('PersistenceManager - getAll returns empty array initially', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    const configs = manager.getAll()

    assert.equal(configs, [])

    cleanup()
})

test('PersistenceManager - getAll returns all configurations', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    manager.save('tenant1', { tenantId: 'tenant1', flowIds: ['flow1'] })
    manager.save('tenant2', { tenantId: 'tenant2', flowIds: ['flow2'] })
    manager.save('tenant3', { tenantId: 'tenant3', flowIds: ['flow3'] })

    const configs = manager.getAll()

    assert.is(configs.length, 3)

    cleanup()
})

// ============ has() Tests ============

test('PersistenceManager - has returns true for existing', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    manager.save('tenant1', { tenantId: 'tenant1', flowIds: ['flow1'] })

    assert.is(manager.has('tenant1'), true)

    cleanup()
})

test('PersistenceManager - has returns false for non-existent', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    assert.is(manager.has('non-existent'), false)

    cleanup()
})

// ============ clear() Tests ============

test('PersistenceManager - clear removes all configurations', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    manager.save('tenant1', { tenantId: 'tenant1', flowIds: ['flow1'] })
    manager.save('tenant2', { tenantId: 'tenant2', flowIds: ['flow2'] })

    manager.clear()

    assert.is(manager.count(), 0)
    assert.equal(manager.getAll(), [])

    cleanup()
})

test('PersistenceManager - clear on empty does nothing', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    manager.clear()

    assert.is(manager.count(), 0)

    cleanup()
})

// ============ count() Tests ============

test('PersistenceManager - count returns 0 initially', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    assert.is(manager.count(), 0)

    cleanup()
})

test('PersistenceManager - count returns correct number', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    manager.save('tenant1', { tenantId: 'tenant1', flowIds: ['flow1'] })
    assert.is(manager.count(), 1)

    manager.save('tenant2', { tenantId: 'tenant2', flowIds: ['flow2'] })
    assert.is(manager.count(), 2)

    manager.remove('tenant1')
    assert.is(manager.count(), 1)

    cleanup()
})

// ============ persist() Tests ============

test('PersistenceManager - persist creates directory if not exists', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
        autoSave: false,
    })

    manager.save('tenant1', { tenantId: 'tenant1', flowIds: ['flow1'] })
    manager.persist()

    assert.ok(existsSync(TEST_DIR))
    assert.ok(existsSync(join(TEST_DIR, TEST_FILE)))

    cleanup()
})

test('PersistenceManager - persist saves all data', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
        autoSave: false,
    })

    manager.save('tenant1', { tenantId: 'tenant1', flowIds: ['flow1'] })
    manager.save('tenant2', { tenantId: 'tenant2', flowIds: ['flow2'] })
    manager.persist()

    // Reload and verify
    const manager2 = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    assert.is(manager2.count(), 2)
    assert.ok(manager2.has('tenant1'))
    assert.ok(manager2.has('tenant2'))

    cleanup()
})

// ============ load() Tests ============

test('PersistenceManager - load handles non-existent file', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: 'non-existent.json',
    })

    assert.is(manager.count(), 0)

    cleanup()
})

test('PersistenceManager - load handles corrupted file', () => {
    cleanup()

    // Create directory
    mkdirSync(TEST_DIR, { recursive: true })

    // Write corrupted JSON
    const fs = require('fs')
    fs.writeFileSync(join(TEST_DIR, TEST_FILE), 'not valid json{', 'utf-8')

    // Should not throw, just use empty data
    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    assert.is(manager.count(), 0)

    cleanup()
})

// ============ deleteFile() Tests ============

test('PersistenceManager - deleteFile removes persistence file', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    manager.save('tenant1', { tenantId: 'tenant1', flowIds: ['flow1'] })

    assert.ok(existsSync(join(TEST_DIR, TEST_FILE)))

    manager.deleteFile()

    assert.not.ok(existsSync(join(TEST_DIR, TEST_FILE)))
    assert.is(manager.count(), 0)

    cleanup()
})

test('PersistenceManager - deleteFile handles non-existent file', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: 'non-existent.json',
        autoSave: false,
    })

    // Should not throw
    manager.deleteFile()

    assert.is(manager.count(), 0)

    cleanup()
})

// ============ getFilePath() Tests ============

test('PersistenceManager - getFilePath returns correct path', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    const path = manager.getFilePath()

    assert.is(path, join(TEST_DIR, TEST_FILE))

    cleanup()
})

// ============ getDefaultPersistence() Tests ============

test('getDefaultPersistence - returns singleton instance', () => {
    cleanup()
    resetDefaultPersistence()

    const instance1 = getDefaultPersistence({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })
    const instance2 = getDefaultPersistence()

    assert.is(instance1, instance2)

    cleanup()
    resetDefaultPersistence()
})

test('getDefaultPersistence - ignores config after first call', () => {
    cleanup()
    resetDefaultPersistence()

    const instance1 = getDefaultPersistence({
        persistenceDir: TEST_DIR,
        fileName: 'first.json',
    })
    const instance2 = getDefaultPersistence({
        persistenceDir: TEST_DIR,
        fileName: 'second.json',
    })

    assert.is(instance1, instance2)
    assert.ok(instance1.getFilePath().includes('first.json'))

    cleanup()
    resetDefaultPersistence()
})

// ============ resetDefaultPersistence() Tests ============

test('resetDefaultPersistence - allows new instance creation', () => {
    cleanup()
    resetDefaultPersistence()

    const instance1 = getDefaultPersistence({
        persistenceDir: TEST_DIR,
        fileName: 'first.json',
    })

    resetDefaultPersistence()

    const instance2 = getDefaultPersistence({
        persistenceDir: TEST_DIR,
        fileName: 'second.json',
    })

    assert.is.not(instance1, instance2)
    assert.ok(instance2.getFilePath().includes('second.json'))

    cleanup()
    resetDefaultPersistence()
})

// ============ Edge Cases ============

test('PersistenceManager - handles special characters in tenantId', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    manager.save('tenant-with-dash', { tenantId: 'tenant-with-dash', flowIds: ['flow1'] })
    manager.save('tenant_with_underscore', { tenantId: 'tenant_with_underscore', flowIds: ['flow1'] })

    assert.ok(manager.has('tenant-with-dash'))
    assert.ok(manager.has('tenant_with_underscore'))

    cleanup()
})

test('PersistenceManager - preserves data across operations', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    // Add, modify, remove
    manager.save('tenant1', { tenantId: 'tenant1', name: 'First', flowIds: ['flow1'] })
    manager.save('tenant2', { tenantId: 'tenant2', name: 'Second', flowIds: ['flow2'] })
    manager.save('tenant3', { tenantId: 'tenant3', name: 'Third', flowIds: ['flow3'] })

    manager.remove('tenant2')
    manager.save('tenant1', { tenantId: 'tenant1', name: 'Updated', flowIds: ['flow1', 'flow2'] })

    // Reload and verify
    const manager2 = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    assert.is(manager2.count(), 2)
    assert.ok(manager2.has('tenant1'))
    assert.not.ok(manager2.has('tenant2'))
    assert.ok(manager2.has('tenant3'))
    assert.is(manager2.get('tenant1')?.name, 'Updated')

    cleanup()
})

test('PersistenceManager - handles empty flowIds array', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    manager.save('tenant1', { tenantId: 'tenant1', flowIds: [] })

    const saved = manager.get('tenant1')
    assert.equal(saved?.flowIds, [])

    cleanup()
})

test('PersistenceManager - handles undefined optional fields', () => {
    cleanup()

    const manager = new PersistenceManager({
        persistenceDir: TEST_DIR,
        fileName: TEST_FILE,
    })

    manager.save('tenant1', {
        tenantId: 'tenant1',
        flowIds: ['flow1'],
        // name, port, options all undefined
    })

    const saved = manager.get('tenant1')
    assert.is(saved?.tenantId, 'tenant1')
    assert.is(saved?.name, undefined)
    assert.is(saved?.port, undefined)

    cleanup()
})

test.run()
