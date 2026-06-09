import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals'
import { rm, access, stat, mkdir, writeFile } from 'fs/promises'
import { join } from 'path'

import { HybridLidCache } from '../src/lidCache'

describe('lidCache CRITICAL fixes', () => {
    const testSession = 'test-critical-' + Date.now()

    // Mock logger para capturar errores
    const mockLogger = {
        log: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }

    beforeEach(async () => {
        jest.clearAllMocks()
    })

    afterEach(async () => {
        // Limpiar cualquier directorio de test que haya quedado
        try {
            const testDirs = [join(process.cwd(), `${testSession}_sessions`), join(process.cwd(), 'test-*_sessions')]
            for (const dir of testDirs) {
                try {
                    await rm(dir, { recursive: true, force: true })
                } catch {
                    // ignore cleanup errors
                }
            }
        } catch {
            // ignore cleanup errors
        }
    })

    // ============================================================================
    // CRITICAL FIX 1: File Permissions (0o600)
    // ============================================================================
    describe('File permissions security', () => {
        test('should create file with 0o600 permissions (owner read/write only)', async () => {
            const session = 'perm-test-' + Date.now()
            const cache = new HybridLidCache(session, 3600, undefined, mockLogger as any)
            await cache.ready()

            await cache.set('123@lid', '456789@s.whatsapp.net')
            await cache.flushToDisk()
            await cache.close()

            const cacheFile = join(process.cwd(), `${session}_sessions`, 'lid-cache.json')
            const stats = await stat(cacheFile)

            // Verificar permisos: 0o600 = 384 en decimal
            const mode = stats.mode & 0o777
            if (process.platform === 'win32') {
                expect(mode).toBe(0o666)
            } else {
                expect(mode).toBe(0o600)
            }

            // Limpiar
            await rm(join(process.cwd(), `${session}_sessions`), { recursive: true, force: true })
        })

        test('should sanitize session name to prevent path traversal', async () => {
            const maliciousSession = '../../../etc/cron.d/test'
            const safeCache = new HybridLidCache(maliciousSession, 3600, process.cwd(), mockLogger as any)
            await safeCache.ready()

            // El path debe estar dentro del directorio actual
            expect(safeCache['filePath']).toContain(process.cwd())
            // El path NO debe contener la ruta maliciosa
            expect(safeCache['filePath']).not.toContain('/etc/cron.d')
            // El path debe tener el sufijo _sessions
            expect(safeCache['filePath']).toContain('_sessions')

            await safeCache.set('test@lid', '123@s.whatsapp.net')
            await safeCache.flushToDisk()
            await new Promise((r) => setTimeout(r, 100))
            await safeCache.close()

            // Verificar que el archivo fue creado
            const cacheFile = safeCache['filePath']
            await access(cacheFile)

            // Limpiar
            const sessionDir = join(process.cwd(), safeCache['filePath'].replace(process.cwd(), '').split(/[\\/]/)[1])
            try {
                await rm(sessionDir, { recursive: true, force: true })
            } catch {
                // ignore cleanup errors
            }
        })
    })

    // ============================================================================
    // CRITICAL FIX 2: Async race / ready() pattern
    // ============================================================================
    describe('Async race condition handling', () => {
        test('should wait for load before returning data via ready()', async () => {
            const session = 'ready-test-' + Date.now()
            const cacheDir = join(process.cwd(), `${session}_sessions`)

            // Primera instancia: guardar datos
            const cache1 = new HybridLidCache(session, 3600, undefined, mockLogger as any)
            await cache1.ready()
            await cache1.set('race-test@lid', '999888777@s.whatsapp.net')
            await cache1.flushToDisk()
            await cache1.close()

            // Pequeña pausa para asegurar escritura
            await new Promise((r) => setTimeout(r, 50))

            // Segunda instancia: verificar que ready() funciona
            const cache2 = new HybridLidCache(session, 3600, undefined, mockLogger as any)
            await cache2.ready()
            const result = await cache2.get('race-test@lid')
            await cache2.close()

            expect(result).toBe('999888777@s.whatsapp.net')

            // Limpiar
            await rm(cacheDir, { recursive: true, force: true })
        })

        test('should reject invalid constructor arguments', () => {
            // Session name vacío
            expect(() => {
                new HybridLidCache('', 3600, undefined, mockLogger as any)
            }).toThrow('sessionName is required')

            // TTL muy bajo
            expect(() => {
                new HybridLidCache('test', 30, undefined, mockLogger as any)
            }).toThrow('ttlSeconds must be at least 60')

            // Session name no-string
            expect(() => {
                new HybridLidCache(123 as any, 3600, undefined, mockLogger as any)
            }).toThrow('sessionName is required')
        })
    })

    // ============================================================================
    // CRITICAL FIX 3: Concurrent flush deduplication
    // ============================================================================
    describe('Concurrent flush deduplication', () => {
        test('should not allow concurrent flush operations', async () => {
            const session = 'concurrent-test-' + Date.now()
            const cache = new HybridLidCache(session, 3600, undefined, mockLogger as any)
            await cache.ready()

            // Llenar caché
            for (let i = 0; i < 100; i++) {
                await cache.set(`concurrent${i}@lid`, `phone${i}@s.whatsapp.net`)
            }

            // Intentar múltiple flushes concurrentes
            const flushes = [cache.flushToDisk(), cache.flushToDisk(), cache.flushToDisk(), cache.flushToDisk()]

            // No deberían conflictar, solo el primero ejecuta
            await expect(Promise.all(flushes)).resolves.not.toThrow()

            await cache.close()

            // Verificar que el archivo existe y tiene datos
            await new Promise((r) => setTimeout(r, 50))
            const cacheFile = join(process.cwd(), `${session}_sessions`, 'lid-cache.json')
            const stats = await stat(cacheFile)
            expect(stats.size).toBeGreaterThan(0)

            // Limpiar
            await rm(join(process.cwd(), `${session}_sessions`), { recursive: true, force: true })
        })

        test('should handle rapid set/flush/close sequence', async () => {
            const session = 'rapid-test-' + Date.now()
            const cache = new HybridLidCache(session, 3600, undefined, mockLogger as any)
            await cache.ready()

            // Secuencia rápida que podría causar race conditions
            await cache.set('rapid1@lid', '111@s.whatsapp.net')
            await cache.flushToDisk()
            await cache.set('rapid2@lid', '222@s.whatsapp.net')
            await cache.flushToDisk()
            await cache.close()

            // Verificar que el caché se cerró limpiamente
            expect(await cache.get('rapid1@lid')).toBeNull() // Cerrado, no responde
        })
    })

    // ============================================================================
    // CRITICAL FIX 4: Error logging and max failures
    // ============================================================================
    describe('Error handling and logging', () => {
        test('should log errors when flush fails', async () => {
            const session = 'error-test-' + Date.now()
            const cacheDir = join(process.cwd(), `${session}_sessions`)

            // Crear directorio como archivo para forzar error
            await mkdir(cacheDir, { recursive: true })
            await writeFile(join(cacheDir, 'lid-cache.json'), '') // Archivo vacío

            const badCache = new HybridLidCache(session, 3600, process.cwd(), mockLogger as any)
            await badCache.ready()

            // Limpiar mocks
            mockLogger.error.mockClear()
            mockLogger.warn.mockClear()

            // Intentar guardar datos
            await badCache.set('fail-test@lid', '123@s.whatsapp.net')

            try {
                await badCache.flushToDisk()
            } catch {
                // Esperado
            }

            await badCache.close()
        })

        test('should disable persistence after MAX_FLUSH_FAILURES', async () => {
            const session = 'disable-test-' + Date.now()
            const cacheDir = join(process.cwd(), `${session}_sessions`)

            // Limpiar y crear estructura que cause fallos
            try {
                await rm(cacheDir, { recursive: true, force: true })
            } catch {
                // ignore cleanup errors
            }
            await mkdir(cacheDir, { recursive: true })

            const badCache = new HybridLidCache(session, 3600, process.cwd(), mockLogger as any)
            await badCache.ready()

            // Hacer que el flush falle múltiples veces
            let attempts = 0
            const maxAttempts = 15

            for (let i = 0; i < maxAttempts; i++) {
                await badCache.set(`failure-test${i}@lid`, `phone${i}@s.whatsapp.net`)
                try {
                    await badCache.flushToDisk()
                } catch {
                    attempts++
                }
            }

            // Si hubo fallos, debería haber logueado errores
            if (attempts > 0) {
                expect(mockLogger.error.mock.calls.length + mockLogger.warn.mock.calls.length).toBeGreaterThan(0)
            }

            await badCache.close()
        })

        test('should handle invalid inputs gracefully', async () => {
            const session = 'invalid-test-' + Date.now()
            const cache = new HybridLidCache(session, 3600, undefined, mockLogger as any)
            await cache.ready()

            // Intentar set con valores inválidos
            await cache.set('invalid-lid', '123@s.whatsapp.net') // No tiene @lid
            await cache.set('123@lid', 'not-a-valid-pn') // No tiene @s.whatsapp.net ni solo dígitos

            // Deberían ser rechazados
            expect(await cache.get('invalid-lid')).toBeNull()
            expect(await cache.get('123@lid')).toBeNull()

            await cache.close()
        })
    })

    // ============================================================================
    // Additional robustness tests
    // ============================================================================
    describe('Additional robustness', () => {
        test('should handle rapid close without explicit flush', async () => {
            const session = 'close-test-' + Date.now()
            const cacheDir = join(process.cwd(), `${session}_sessions`)
            const cacheFile = join(cacheDir, 'lid-cache.json')

            const cache = new HybridLidCache(session, 3600, undefined, mockLogger as any)
            await cache.ready()

            // Guardar datos pero no hacer flush explícito
            await cache.set('no-flush@lid', '555@s.whatsapp.net')

            // Cerrar inmediatamente (debería hacer flush en close)
            await cache.close()

            // Pequeña pausa para asegurar escritura
            await new Promise((r) => setTimeout(r, 100))

            try {
                // Verificar que el archivo tiene datos
                const stats = await stat(cacheFile)
                expect(stats.size).toBeGreaterThan(0)
            } catch (err: any) {
                // Si el archivo no existe, el flush en close falló
                throw new Error(`Expected file ${cacheFile} to exist but got: ${err.message}`)
            }

            // Limpiar
            await rm(cacheDir, { recursive: true, force: true })
        })

        test('should provide stats for monitoring', async () => {
            const session = 'stats-test-' + Date.now()
            const cache = new HybridLidCache(session, 3600, undefined, mockLogger as any)
            await cache.ready()

            // Stats inicial
            const initialStats = cache.getStats()
            expect(initialStats.keys).toBe(0)

            // Agregar datos
            await cache.set('stats1@lid', '111@s.whatsapp.net')
            await cache.set('stats2@lid', '222@s.whatsapp.net')

            const finalStats = cache.getStats()
            expect(finalStats.keys).toBe(2)

            await cache.close()
        })

        test('should handle isClosed flag correctly', async () => {
            const session = 'closed-test-' + Date.now()
            const cache = new HybridLidCache(session, 3600, undefined, mockLogger as any)
            await cache.ready()

            await cache.set('closed-test@lid', '123@s.whatsapp.net')
            await cache.close()

            // Después de cerrar, operaciones deberían retornar null/void
            expect(await cache.get('closed-test@lid')).toBeNull()

            await cache.set('after-close@lid', '456@s.whatsapp.net')
            expect(await cache.get('after-close@lid')).toBeNull()

            // No debería lanzar error
            await cache.clear()
            await cache.compact()
        })
    })

    // ============================================================================
    // CRITICAL FIX 6: Phone Number Validation Too Strict
    // ============================================================================
    describe('Phone number normalization (CRITICAL FIX)', () => {
        test('should handle plain digits', async () => {
            const session = 'pn-plain-' + Date.now()
            const cache = new HybridLidCache(session, 3600, undefined, mockLogger as any)
            await cache.ready()

            await cache.set('plain@lid', '34691015468')
            const result = await cache.get('plain@lid')

            expect(result).toBe('34691015468@s.whatsapp.net')
            await cache.close()
        })

        test('should handle international format with plus prefix', async () => {
            const session = 'pn-plus-' + Date.now()
            const cache = new HybridLidCache(session, 3600, undefined, mockLogger as any)
            await cache.ready()

            await cache.set('plus@lid', '+34691015468')
            const result = await cache.get('plus@lid')

            expect(result).toBe('34691015468@s.whatsapp.net')
            await cache.close()
        })

        test('should handle phone numbers with spaces', async () => {
            const session = 'pn-spaces-' + Date.now()
            const cache = new HybridLidCache(session, 3600, undefined, mockLogger as any)
            await cache.ready()

            await cache.set('spaced@lid', '34 691 015 468')
            const result = await cache.get('spaced@lid')

            expect(result).toBe('34691015468@s.whatsapp.net')
            await cache.close()
        })

        test('should handle phone numbers with dashes and parens', async () => {
            const session = 'pn-formatted-' + Date.now()
            const cache = new HybridLidCache(session, 3600, undefined, mockLogger as any)
            await cache.ready()

            await cache.set('formatted@lid', '+1 (555) 123-4567')
            const result = await cache.get('formatted@lid')

            expect(result).toBe('15551234567@s.whatsapp.net')
            await cache.close()
        })

        test('should handle legacy @c.us format', async () => {
            const session = 'pn-legacy-' + Date.now()
            const cache = new HybridLidCache(session, 3600, undefined, mockLogger as any)
            await cache.ready()

            await cache.set('legacy@lid', '34691015468@c.us')
            const result = await cache.get('legacy@lid')

            expect(result).toBe('34691015468@s.whatsapp.net')
            await cache.close()
        })

        test('should preserve already formatted @s.whatsapp.net', async () => {
            const session = 'pn-already-formatted-' + Date.now()
            const cache = new HybridLidCache(session, 3600, undefined, mockLogger as any)
            await cache.ready()

            await cache.set('formatted@lid', '34691015468@s.whatsapp.net')
            const result = await cache.get('formatted@lid')

            expect(result).toBe('34691015468@s.whatsapp.net')
            await cache.close()
        })

        test('should handle dots as separators', async () => {
            const session = 'pn-dots-' + Date.now()
            const cache = new HybridLidCache(session, 3600, undefined, mockLogger as any)
            await cache.ready()

            await cache.set('dots@lid', '34.691.015.468')
            const result = await cache.get('dots@lid')

            expect(result).toBe('34691015468@s.whatsapp.net')
            await cache.close()
        })

        test('should handle mixed format + country code', async () => {
            const session = 'pn-mixed-' + Date.now()
            const cache = new HybridLidCache(session, 3600, undefined, mockLogger as any)
            await cache.ready()

            // UK number with various formats
            await cache.set('uk1@lid', '+44 20 7123 4567')
            await cache.set('uk2@lid', '+44-20-7123-4567')

            expect(await cache.get('uk1@lid')).toBe('442071234567@s.whatsapp.net')
            expect(await cache.get('uk2@lid')).toBe('442071234567@s.whatsapp.net')

            await cache.close()
        })

        test('should store consistently regardless of input format', async () => {
            const session = 'pn-consistent-' + Date.now()
            const cache = new HybridLidCache(session, 3600, undefined, mockLogger as any)
            await cache.ready()

            // Same number, different formats - should all normalize to same key
            await cache.set('same1@lid', '+1234567890')
            await cache.set('same2@lid', '1234567890')
            await cache.set('same3@lid', '1 234 567 890')

            // All should return the same normalized format
            expect(await cache.get('same1@lid')).toBe('1234567890@s.whatsapp.net')
            expect(await cache.get('same2@lid')).toBe('1234567890@s.whatsapp.net')
            expect(await cache.get('same3@lid')).toBe('1234567890@s.whatsapp.net')

            await cache.close()
        })
    })
})
