/**
 * Edge Case Tests for LID Cache
 * Tests boundary conditions, unusual inputs, and stress scenarios
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { rm, mkdir } from 'fs/promises'
import { join } from 'path'

import { HybridLidCache, MemoryLidCache, normalizeLid } from '../src/lidCache'

// Mock logger to capture events
const createMockLogger = () => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
})

// ============================================================================
// EDGE CASE: Empty and Minimal Inputs
// ============================================================================
describe('lidCache EDGE CASES: Empty and Minimal Inputs', () => {
    let cache: HybridLidCache
    let testDir: string

    beforeEach(async () => {
        const session = `edge-empty-${Date.now()}-${Math.random().toString(36).slice(2)}`
        testDir = join(process.cwd(), `${session}_sessions`)
        await mkdir(testDir, { recursive: true })
        cache = new HybridLidCache(session, 3600, undefined, createMockLogger() as any)
        await cache.ready()
    })

    afterEach(async () => {
        await cache.close().catch(() => {})
        await rm(testDir, { recursive: true, force: true }).catch(() => {})
    })

    test('should handle empty string LID', async () => {
        await cache.set('', '123@s.whatsapp.net')
        const result = await cache.get('')
        expect(result).toBeNull() // Empty LID rejected by validation
    })

    test('should handle empty string PN', async () => {
        await cache.set('test@lid', '')
        const result = await cache.get('test@lid')
        expect(result).toBeNull() // Empty PN rejected by validation
    })

    test('should handle whitespace-only LID', async () => {
        await cache.set('   ', '123@s.whatsapp.net')
        expect(await cache.get('   ')).toBeNull()
    })

    test('should handle whitespace-only PN', async () => {
        await cache.set('test@lid', '   ')
        expect(await cache.get('test@lid')).toBeNull()
    })

    test('should handle minimum valid LID', async () => {
        // Minimum: 1@lid = 5 characters
        await cache.set('1@lid', '1234567890@s.whatsapp.net')
        expect(await cache.get('1@lid')).toBe('1234567890@s.whatsapp.net')
    })

    test('should handle single digit PN', async () => {
        await cache.set('single@lid', '1')
        // Single digit passes validation, gets normalized
        expect(await cache.get('single@lid')).toBe('1@s.whatsapp.net')
    })
})

// ============================================================================
// EDGE CASE: Extremely Long Inputs
// ============================================================================
describe('lidCache EDGE CASES: Extremely Long Inputs', () => {
    let cache: HybridLidCache
    let testDir: string

    beforeEach(async () => {
        const session = `edge-long-${Date.now()}-${Math.random().toString(36).slice(2)}`
        testDir = join(process.cwd(), `${session}_sessions`)
        await mkdir(testDir, { recursive: true })
        cache = new HybridLidCache(session, 3600, undefined, createMockLogger() as any)
        await cache.ready()
    })

    afterEach(async () => {
        await cache.close().catch(() => {})
        await rm(testDir, { recursive: true, force: true }).catch(() => {})
    })

    test('should handle very long LID (1000 chars)', async () => {
        const longLid = 'a'.repeat(990) + '@lid'
        await cache.set(longLid, '123@s.whatsapp.net')
        expect(await cache.get(longLid)).toBe('123@s.whatsapp.net')
    })

    test('should handle very long PN (1000 digits)', async () => {
        const longPn = '1'.repeat(1000)
        await cache.set('longpn@lid', longPn)
        const result = await cache.get('longpn@lid')
        expect(result).toBe(`${longPn}@s.whatsapp.net`)
    })

    test('should handle LID at NodeCache key size limit', async () => {
        // NodeCache has no explicit key limit, but test reasonable boundary
        const boundaryLid = '1234567890123456789012345678901234567890@lid'
        await cache.set(boundaryLid, '123@s.whatsapp.net')
        expect(await cache.get(boundaryLid)).toBe('123@s.whatsapp.net')
    })
})

// ============================================================================
// EDGE CASE: Special Characters and Unicode
// ============================================================================
describe('lidCache EDGE CASES: Special Characters and Unicode', () => {
    let cache: HybridLidCache
    let testDir: string

    beforeEach(async () => {
        const session = `edge-special-${Date.now()}-${Math.random().toString(36).slice(2)}`
        testDir = join(process.cwd(), `${session}_sessions`)
        await mkdir(testDir, { recursive: true })
        cache = new HybridLidCache(session, 3600, undefined, createMockLogger() as any)
        await cache.ready()
    })

    afterEach(async () => {
        await cache.close().catch(() => {})
        await rm(testDir, { recursive: true, force: true }).catch(() => {})
    })

    test('should handle LID with special characters before @lid', async () => {
        // LID format allows any string before @lid
        const specialLid = '123:45:67@lid'
        await cache.set(specialLid, '123@s.whatsapp.net')
        // normalizeLid removes device suffix, so 123:45:67@lid becomes 123@lid
        expect(await cache.get(specialLid)).toBe('123@s.whatsapp.net')
    })

    test('should handle unicode in PN (emoji preserved)', async () => {
        // Unicode is preserved but digits are extracted
        // Current behavior: accepts if has digits, emoji stays in output
        await cache.set('unicode@lid', '📱1234567890')
        // Note: normalizePn doesn't strip emoji, only +, spaces, -, ., (, )
        // This may return the emoji with digits - implementation detail
        const result = await cache.get('unicode@lid')
        // Contains the digits at minimum
        expect(result).toContain('1234567890')
    })

    test('should handle emoji in LID (if valid format)', async () => {
        // Emoji before @lid - technically passes validation but unusual
        const emojiLid = '123😀@lid'
        await cache.set(emojiLid, '123@s.whatsapp.net')
        expect(await cache.get(emojiLid)).toBe('123@s.whatsapp.net')
    })

    test('should handle newline characters in PN', async () => {
        await cache.set('newline@lid', '123\n456\n7890')
        // Newlines should be stripped during normalization
        const result = await cache.get('newline@lid')
        expect(result).toBe('1234567890@s.whatsapp.net')
    })

    test('should handle tab characters in PN', async () => {
        await cache.set('tab@lid', '123\t456\t7890')
        expect(await cache.get('tab@lid')).toBe('1234567890@s.whatsapp.net')
    })
})

// ============================================================================
// EDGE CASE: Device Suffix Variations
// ============================================================================
describe('lidCache EDGE CASES: Device Suffix Variations', () => {
    let cache: HybridLidCache
    let testDir: string

    beforeEach(async () => {
        const session = `edge-device-${Date.now()}-${Math.random().toString(36).slice(2)}`
        testDir = join(process.cwd(), `${session}_sessions`)
        await mkdir(testDir, { recursive: true })
        cache = new HybridLidCache(session, 3600, undefined, createMockLogger() as any)
        await cache.ready()
    })

    afterEach(async () => {
        await cache.close().catch(() => {})
        await rm(testDir, { recursive: true, force: true }).catch(() => {})
    })

    test('should normalize device suffix :0 through :99', async () => {
        const baseLid = '123456789'
        const pn = '5555555555@s.whatsapp.net'

        // Set with device 0
        await cache.set(`${baseLid}:0@lid`, pn)

        // Should find with any device suffix
        for (let i = 0; i < 100; i++) {
            expect(await cache.get(`${baseLid}:${i}@lid`)).toBe(pn)
        }
    })

    test('should handle large device numbers', async () => {
        await cache.set('123:999999@lid', '555@s.whatsapp.net')
        expect(await cache.get('123:1@lid')).toBe('555@s.whatsapp.net')
    })

    test('should handle multi-colon LIDs', async () => {
        // Edge case: multiple colons before @lid
        await cache.set('a:b:c:1@lid', '111@s.whatsapp.net')
        // normalizeLid replaces :\d+(?=@lid$) - only removes last :digits
        expect(await cache.get('a:b:c:99@lid')).toBe('111@s.whatsapp.net')
    })

    test('should NOT normalize if no @lid suffix', async () => {
        // Regular JIDs should not be normalized
        await cache.set('123:45@s.whatsapp.net', '555@s.whatsapp.net')
        // This is not a valid LID, so validation may reject it
        // but if accepted, should remain as-is
        const result = await cache.get('123:45@s.whatsapp.net')
        // LID validation requires @lid, so this should be null
        expect(result).toBeNull()
    })
})

// ============================================================================
// EDGE CASE: Zero, Null, Undefined, NaN
// ============================================================================
describe('lidCache EDGE CASES: Zero, Null, Undefined, NaN', () => {
    let cache: HybridLidCache
    let testDir: string

    beforeEach(async () => {
        const session = `edge-null-${Date.now()}-${Math.random().toString(36).slice(2)}`
        testDir = join(process.cwd(), `${session}_sessions`)
        await mkdir(testDir, { recursive: true })
        cache = new HybridLidCache(session, 3600, undefined, createMockLogger() as any)
        await cache.ready()
    })

    afterEach(async () => {
        await cache.close().catch(() => {})
        await rm(testDir, { recursive: true, force: true }).catch(() => {})
    })

    test('should handle null as LID', async () => {
        await (cache.set as any)(null, '123@s.whatsapp.net')
        expect(await (cache.get as any)(null)).toBeNull()
    })

    test('should handle undefined as LID', async () => {
        await (cache.set as any)(undefined, '123@s.whatsapp.net')
        expect(await (cache.get as any)(undefined)).toBeNull()
    })

    test('should handle null as PN', async () => {
        await (cache.set as any)('test@lid', null)
        expect(await cache.get('test@lid')).toBeNull()
    })

    test('should handle undefined as PN', async () => {
        await (cache.set as any)('test@lid', undefined)
        expect(await cache.get('test@lid')).toBeNull()
    })

    test('should handle number 0 as LID', async () => {
        await (cache.set as any)(0, '123@s.whatsapp.net')
        expect(await (cache.get as any)(0)).toBeNull()
    })

    test('should handle number 0 as PN', async () => {
        await (cache.set as any)('test@lid', 0)
        // 0 as PN - passes validation (typeof === 'number' fails first check)
        expect(await cache.get('test@lid')).toBeNull()
    })

    test('should handle empty object as LID', async () => {
        await (cache.set as any)({}, '123@s.whatsapp.net')
        expect(await (cache.get as any)({})).toBeNull()
    })

    test('should handle empty array as LID', async () => {
        await (cache.set as any)([], '123@s.whatsapp.net')
        expect(await (cache.get as any)([])).toBeNull()
    })
})

// ============================================================================
// EDGE CASE: Boolean and Type Coercion
// ============================================================================
describe('lidCache EDGE CASES: Boolean and Type Coercion', () => {
    let cache: HybridLidCache
    let testDir: string

    beforeEach(async () => {
        const session = `edge-bool-${Date.now()}-${Math.random().toString(36).slice(2)}`
        testDir = join(process.cwd(), `${session}_sessions`)
        await mkdir(testDir, { recursive: true })
        cache = new HybridLidCache(session, 3600, undefined, createMockLogger() as any)
        await cache.ready()
    })

    afterEach(async () => {
        await cache.close().catch(() => {})
        await rm(testDir, { recursive: true, force: true }).catch(() => {})
    })

    test('should handle true as LID', async () => {
        await (cache.set as any)(true, '123@s.whatsapp.net')
        expect(await (cache.get as any)(true)).toBeNull()
    })

    test('should handle false as LID', async () => {
        await (cache.set as any)(false, '123@s.whatsapp.net')
        expect(await (cache.get as any)(false)).toBeNull()
    })

    test('should handle string "true" as LID', async () => {
        // "true" includes '@lid'? No. Should be rejected.
        await cache.set('true', '123@s.whatsapp.net')
        expect(await cache.get('true')).toBeNull()
    })

    test('should handle string "false" as LID', async () => {
        await cache.set('false', '123@s.whatsapp.net')
        expect(await cache.get('false')).toBeNull()
    })

    test('should handle string "null" as LID', async () => {
        await cache.set('null', '123@s.whatsapp.net')
        expect(await cache.get('null')).toBeNull()
    })

    test('should handle string "undefined" as LID', async () => {
        await cache.set('undefined', '123@s.whatsapp.net')
        expect(await cache.get('undefined')).toBeNull()
    })
})

// ============================================================================
// EDGE CASE: Rapid Operations Stress Test
// ============================================================================
describe('lidCache EDGE CASES: Rapid Operations Stress Test', () => {
    let cache: HybridLidCache
    let testDir: string

    beforeEach(async () => {
        const session = `edge-rapid-${Date.now()}-${Math.random().toString(36).slice(2)}`
        testDir = join(process.cwd(), `${session}_sessions`)
        await mkdir(testDir, { recursive: true })
        cache = new HybridLidCache(session, 3600, undefined, createMockLogger() as any)
        await cache.ready()
    })

    afterEach(async () => {
        await cache.close().catch(() => {})
        await rm(testDir, { recursive: true, force: true }).catch(() => {})
    })

    test('should handle 1000 rapid sets', async () => {
        const promises = []
        for (let i = 0; i < 1000; i++) {
            promises.push(cache.set(`rapid${i}@lid`, `${i}@s.whatsapp.net`))
        }
        await Promise.all(promises)

        // Verify all were stored
        for (let i = 0; i < 1000; i++) {
            expect(await cache.get(`rapid${i}@lid`)).toBe(`${i}@s.whatsapp.net`)
        }
    })

    test('should handle rapid get/set interleaved', async () => {
        const operations = []
        for (let i = 0; i < 100; i++) {
            operations.push(cache.set(`inter${i}@lid`, `val${i}@s.whatsapp.net`))
            operations.push(cache.get(`inter${i}@lid`))
        }
        await Promise.all(operations)

        // All should be set
        for (let i = 0; i < 100; i++) {
            expect(await cache.get(`inter${i}@lid`)).toBe(`val${i}@s.whatsapp.net`)
        }
    })

    test('should handle set same key 100 times rapidly', async () => {
        const promises = []
        for (let i = 0; i < 100; i++) {
            promises.push(cache.set('same@lid', `val${i}@s.whatsapp.net`))
        }
        await Promise.all(promises)

        // Should have last value (or any, due to race)
        const result = await cache.get('same@lid')
        expect(result).toMatch(/^val\d+@s\.whatsapp\.net$/)
    })

    test('should handle rapid clear and reuse', async () => {
        for (let i = 0; i < 10; i++) {
            await cache.set(`cycle${i}@lid`, `value${i}@s.whatsapp.net`)
            await cache.clear()
        }

        // Should be empty after final clear
        expect(await cache.get('cycle0@lid')).toBeNull()
    })
})

// ============================================================================
// EDGE CASE: Simultaneous Instances (Isolation)
// ============================================================================
describe('lidCache EDGE CASES: Simultaneous Instances', () => {
    test('should isolate separate cache instances', async () => {
        const session1 = `iso1-${Date.now()}`
        const session2 = `iso2-${Date.now()}`

        const cache1 = new HybridLidCache(session1, 3600)
        const cache2 = new HybridLidCache(session2, 3600)

        await cache1.ready()
        await cache2.ready()

        await cache1.set('shared@lid', '111@s.whatsapp.net')
        await cache2.set('shared@lid', '222@s.whatsapp.net')

        expect(await cache1.get('shared@lid')).toBe('111@s.whatsapp.net')
        expect(await cache2.get('shared@lid')).toBe('222@s.whatsapp.net')

        await cache1.close()
        await cache2.close()

        // Cleanup
        await rm(join(process.cwd(), `${session1}_sessions`), { recursive: true, force: true })
        await rm(join(process.cwd(), `${session2}_sessions`), { recursive: true, force: true })
    })

    test('should handle same session file accessed by two instances (last write wins)', async () => {
        const session = `shared-${Date.now()}`

        const cache1 = new HybridLidCache(session, 3600)
        await cache1.ready()
        await cache1.set('conflict@lid', 'first@s.whatsapp.net')
        await cache1.flushToDisk()

        // Small delay to ensure flush
        await new Promise((r) => setTimeout(r, 50))

        const cache2 = new HybridLidCache(session, 3600)
        await cache2.ready()
        await cache2.set('conflict@lid', 'second@s.whatsapp.net')
        await cache2.flushToDisk()
        await cache2.close()

        // Reopen to verify last write
        const cache3 = new HybridLidCache(session, 3600)
        await cache3.ready()
        const result = await cache3.get('conflict@lid')
        await cache3.close()

        expect(result).toBe('second@s.whatsapp.net')

        await cache1.close()
        await rm(join(process.cwd(), `${session}_sessions`), { recursive: true, force: true })
    })
})

// ============================================================================
// EDGE CASE: MemoryLidCache Specific
// ============================================================================
describe('lidCache EDGE CASES: MemoryLidCache Specific', () => {
    test('should not persist to disk (memory only)', async () => {
        const cache = new MemoryLidCache(3600)
        await cache.set('memory@lid', '123@s.whatsapp.net')

        // Create new instance - should not have data
        const cache2 = new MemoryLidCache(3600)
        expect(await cache2.get('memory@lid')).toBeNull()
    })

    test('should respect TTL in memory cache', async () => {
        const cache = new MemoryLidCache(1) // 1 second TTL
        await cache.set('ttl@lid', '123@s.whatsapp.net')

        expect(await cache.get('ttl@lid')).toBe('123@s.whatsapp.net')

        // Wait for TTL
        await new Promise((r) => setTimeout(r, 1100))

        expect(await cache.get('ttl@lid')).toBeNull()
    })

    test('MemoryLidCache should handle all edge cases same as Hybrid', async () => {
        const cache = new MemoryLidCache(3600)

        // Empty
        await cache.set('', '123@s.whatsapp.net')
        expect(await cache.get('')).toBeNull()

        // Null
        await (cache.set as any)(null, '123@s.whatsapp.net')
        expect(await (cache.get as any)(null)).toBeNull()

        // Long
        const longLid = 'a'.repeat(1000) + '@lid'
        await cache.set(longLid, '123@s.whatsapp.net')
        expect(await cache.get(longLid)).toBe('123@s.whatsapp.net')

        // Unicode
        await cache.set('emoji😀@lid', '123@s.whatsapp.net')
        expect(await cache.get('emoji😀@lid')).toBe('123@s.whatsapp.net')
    })
})

// ============================================================================
// EDGE CASE: File System Edge Cases
// ============================================================================
describe('lidCache EDGE CASES: File System', () => {
    test('should handle very long session name (255 chars)', async () => {
        const longName = 'a'.repeat(245) // + '_sessions' = 255
        const cache = new HybridLidCache(longName, 3600)
        await cache.ready()

        await cache.set('test@lid', '123@s.whatsapp.net')
        expect(await cache.get('test@lid')).toBe('123@s.whatsapp.net')

        await cache.close()
        await rm(join(process.cwd(), `${longName}_sessions`), { recursive: true, force: true })
    })

    test('should handle session name with dots', async () => {
        const dotName = 'session.v1.2.3'
        const cache = new HybridLidCache(dotName, 3600)
        await cache.ready()

        await cache.set('test@lid', '123@s.whatsapp.net')
        await cache.flushToDisk()
        await cache.close()

        // Verify file was created
        const fs = await import('fs/promises')
        const filePath = join(process.cwd(), `${dotName}_sessions`, 'lid-cache.json')
        const stats = await fs.stat(filePath)
        expect(stats.isFile()).toBe(true)

        await rm(join(process.cwd(), `${dotName}_sessions`), { recursive: true, force: true })
    })
})

// ============================================================================
// EDGE CASE: normalizeLid Function Directly
// ============================================================================
describe('lidCache EDGE CASES: normalizeLid Function', () => {
    test('should return non-lid strings unchanged', () => {
        expect(normalizeLid('123@s.whatsapp.net')).toBe('123@s.whatsapp.net')
        expect(normalizeLid('123@c.us')).toBe('123@c.us')
        expect(normalizeLid('random string')).toBe('random string')
        expect(normalizeLid('')).toBe('')
    })

    test('should handle LID without device suffix', () => {
        expect(normalizeLid('123456789@lid')).toBe('123456789@lid')
    })

    test('should remove device suffix from LID', () => {
        expect(normalizeLid('123456789:0@lid')).toBe('123456789@lid')
        expect(normalizeLid('123456789:99@lid')).toBe('123456789@lid')
        expect(normalizeLid('123456789:999999@lid')).toBe('123456789@lid')
    })

    test('should only remove last device suffix', () => {
        // Multiple colons - only last :digits@lid is removed
        expect(normalizeLid('a:b:c:1@lid')).toBe('a:b:c@lid')
    })

    test('should handle LID-like strings that are not LIDs', () => {
        // :digits but no @lid
        expect(normalizeLid('123:45@s.whatsapp.net')).toBe('123:45@s.whatsapp.net')

        // @lid but no prefix
        expect(normalizeLid('@lid')).toBe('@lid') // Invalid but passes
    })

    test('should handle undefined/null gracefully', () => {
        expect(normalizeLid(undefined as any)).toBe(undefined)
        expect(normalizeLid(null as any)).toBe(null)
    })
})

// ============================================================================
// EDGE CASE: Concurrency with Close
// ============================================================================
describe('lidCache EDGE CASES: Concurrency with Close', () => {
    test('should handle set during close gracefully', async () => {
        const session = `close-race-${Date.now()}`
        const cache = new HybridLidCache(session, 3600)
        await cache.ready()

        // Start close
        const closePromise = cache.close()

        // Try to set during close - should not throw
        await expect(cache.set('late@lid', '123@s.whatsapp.net')).resolves.not.toThrow()

        await closePromise

        await rm(join(process.cwd(), `${session}_sessions`), { recursive: true, force: true })
    })

    test('should handle get during close gracefully', async () => {
        const session = `get-close-${Date.now()}`
        const cache = new HybridLidCache(session, 3600)
        await cache.ready()
        await cache.set('existing@lid', '123@s.whatsapp.net')

        // Start close
        const closePromise = cache.close()

        // Try to get during close
        const result = await cache.get('existing@lid')

        await closePromise

        // May return value or null depending on timing
        expect(result === '123@s.whatsapp.net' || result === null).toBe(true)

        await rm(join(process.cwd(), `${session}_sessions`), { recursive: true, force: true })
    })
})
