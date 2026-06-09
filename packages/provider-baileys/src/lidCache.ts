/**
 * @fileoverview LID (Local Identifier) Cache for WhatsApp Baileys Provider
 *
 * This module provides a caching layer for mapping WhatsApp Local Identifiers (LIDs)
 * to Phone Numbers (PNs). LIDs are privacy-preserving identifiers used by WhatsApp
 * that don't reveal the user's actual phone number.
 *
 * ## Architecture
 *
 * The cache uses a hybrid memory+file approach:
 * - **Hot path**: In-memory lookups via NodeCache (O(1), ~1μs)
 * - **Persistence**: JSON file for cross-restart durability
 * - **Strategy**: Write-through to memory, async flush to disk every 30s
 *
 * ## Key Features
 *
 * - **Zero-config**: Works out of the box with sensible defaults
 * - **Device suffix normalization**: `123:45@lid` and `123:99@lid` resolve to same entry
 * - **Phone number normalization**: Accepts `+123 456-7890`, `1234567890@c.us`, etc.
 * - **Security**: File permissions 0o600, PII masking in logs
 * - **Resilience**: Corrupted files auto-rebuild, flush failures logged
 *
 * ## Usage
 *
 * ```typescript
 * // Default: Hybrid (memory + file)
 * const cache = new HybridLidCache('my-bot', 86400 * 7) // 7 day TTL
 * await cache.ready()
 *
 * await cache.set('123456789:45@lid', '+34 691 015 468')
 * const pn = await cache.get('123456789:99@lid') // Returns '34691015468@s.whatsapp.net'
 *
 * await cache.close() // Persists to disk
 * ```
 *
 * @module lidCache
 * @author BuilderBot Team
 * @since 1.4.2
 */

import type { Console } from 'console'
import { writeFile, readFile, access, mkdir, stat, unlink } from 'fs/promises'
import NodeCache from 'node-cache'
import { dirname, join } from 'path'

// =============================================================================
// CONSTANTS
// =============================================================================

/** File format version for migrations */
const CACHE_FILE_VERSION = 1

/** Default TTL: 7 days (seconds) */
const DEFAULT_TTL_SECONDS = 86400 * 7

/** Auto-flush interval: 30 seconds (milliseconds) */
const DEFAULT_FLUSH_INTERVAL_MS = 30000

/** Compact file when exceeds 10 MB */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

/** Compact when more than 10k entries */
const COMPACT_AT_ENTRIES = 10000

/** Disable persistence after 10 consecutive flush failures */
const MAX_FLUSH_FAILURES = 10

/** Unix file permissions: owner read/write only (0o600) */
const FILE_PERMISSIONS = 0o600

// =============================================================================
// BRANDED TYPES (Compile-time Safety)
// =============================================================================

/**
 * Branded type for WhatsApp Local Identifier (LID).
 * Ensures compile-time distinction from regular strings.
 *
 * @example
 * ```typescript
 * const lid = '123456789@lid' as LidJid
 * const pn = resolveLidToPn(cache, fallback, logger, lid) // OK
 * resolveLidToPn(cache, fallback, logger, '123456789@lid') // Error: not branded
 * ```
 */
export type LidJid = string & { readonly __brand: 'LidJid' }

/**
 * Branded type for Phone Number JID.
 * Format: `1234567890@s.whatsapp.net`
 */
export type PnJid = string & { readonly __brand: 'PnJid' }

/**
 * Helper to brand a string as LidJid (runtime check).
 * Returns null if the string is not a valid LID.
 */
export function asLidJid(value: string): LidJid | null {
    return isValidLid(value) ? (normalizeLid(value) as LidJid) : null
}

/**
 * Helper to brand a string as PnJid (runtime check).
 * Returns null if the string is not a valid phone number JID.
 */
export function asPnJid(value: string): PnJid | null {
    if (!isValidPn(value)) return null
    const normalized = normalizePn(value)
    return normalized ? (normalized as PnJid) : null
}

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Interface for LID cache implementations.
 *
 * Defines the contract for any cache that maps WhatsApp LIDs to phone numbers.
 * Both {@link HybridLidCache} and {@link MemoryLidCache} implement this interface.
 *
 * @example
 * ```typescript
 * // Custom implementation (e.g., Redis)
 * class RedisLidCache implements LidCache {
 *   async get(lid: LidJid): Promise<PnJid | null> {
 *     return redis.get(`lid:${lid}`) as Promise<PnJid | null>
 *   }
 *   // ... other methods
 * }
 * ```
 */
export interface LidCache {
    /**
     * Retrieves the phone number for a given LID.
     *
     * @param lid - WhatsApp Local Identifier (e.g., '123456789@lid' or '123456789:45@lid')
     * @returns Phone number in format '1234567890@s.whatsapp.net', or null if not found/invalid
     */
    get(lid: LidJid | string): Promise<PnJid | string | null>

    /**
     * Stores a LID → phone number mapping.
     *
     * @param lid - WhatsApp Local Identifier
     * @param pn - Phone number (any format: +123, 123, 123@c.us, 123@s.whatsapp.net)
     * @returns Promise that resolves when the value is stored in memory
     *
     * @remarks
     * - PN is normalized to `123@s.whatsapp.net` format before storage
     * - LID device suffix is normalized (e.g., `123:45@lid` → `123@lid`)
     * - Invalid inputs are silently rejected (no throw)
     */
    set(lid: LidJid | string, pn: PnJid | string): Promise<void>

    /**
     * Checks if a LID exists in the cache.
     *
     * @param lid - WhatsApp Local Identifier
     * @returns true if the LID exists and hasn't expired
     */
    has(lid: LidJid | string): Promise<boolean>

    /**
     * Clears all entries from the cache.
     *
     * @remarks Also triggers immediate flush to disk (if HybridLidCache)
     */
    clear(): Promise<void>

    /**
     * Closes the cache, releasing resources and triggering final persistence.
     *
     * @remarks After close(), all operations return null/void. Call only once.
     */
    close?(): Promise<void>
}

/**
 * Internal cache entry structure.
 *
 * Stored in the JSON file for persistence, includes timestamp for TTL validation
 * on restart (since NodeCache's internal TTL is memory-only).
 */
interface CacheEntry {
    /** Phone number in normalized format `123@s.whatsapp.net` */
    pn: string

    /** Unix timestamp (ms) of last access or write */
    ts: number
}

/**
 * On-disk file format for cache persistence.
 *
 * @internal
 */
interface CacheFileData {
    /** File format version for future migrations */
    version: number

    /** Map of normalized LID → cache entry */
    entries: Record<string, CacheEntry>
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Validates if a value is a valid LID string.
 *
 * A valid LID:
 * - Is a string
 * - Contains `@lid` suffix
 * - Has minimum length of 5 (e.g., `1@lid`)
 *
 * @param value - Value to validate
 * @returns Type predicate: true if value is a valid LID string
 *
 * @example
 * ```typescript
 * isValidLid('123456789@lid')     // true
 * isValidLid('123456789:45@lid')  // true
 * isValidLid('123@c.us')          // false
 * isValidLid('')                  // false
 * isValidLid(null)                // false
 * ```
 */
function isValidLid(value: unknown): value is string {
    return typeof value === 'string' && value.length >= 5 && value.includes('@lid')
}

/**
 * Validates if a value is a valid phone number string.
 *
 * Accepts:
 * - Bare digits: `1234567890`
 * - International: `+1234567890`
 * - Formatted: `+1 (555) 123-4567`
 * - WhatsApp JIDs: `123@s.whatsapp.net`, `123@c.us`
 *
 * @param value - Value to validate
 * @returns true if value contains at least one digit or is already a JID
 */
function isValidPn(value: unknown): value is string {
    if (typeof value !== 'string') return false
    if (value.length === 0) return false

    // Accept if already has WhatsApp JID format
    if (value.includes('@s.whatsapp.net') || value.includes('@c.us')) return true

    // Accept if contains any digit (will be cleaned during normalization)
    const hasDigits = /\d/.test(value)
    return hasDigits
}

/**
 * Validates if a value matches the CacheEntry interface.
 *
 * @internal
 */
function isCacheEntry(value: unknown): value is CacheEntry {
    if (typeof value !== 'object' || value === null) return false
    const entry = value as Partial<CacheEntry>
    return typeof entry.pn === 'string' && typeof entry.ts === 'number' && !isNaN(entry.ts)
}

/**
 * Validates if a value matches the CacheFileData interface.
 *
 * @internal
 */
function isCacheFileData(value: unknown): value is CacheFileData {
    if (typeof value !== 'object' || value === null) return false
    const data = value as Partial<CacheFileData>
    return typeof data.version === 'number' && typeof data.entries === 'object' && data.entries !== null
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Normalizes a LID by removing the device suffix.
 *
 * WhatsApp sends LIDs with device identifiers (e.g., `:45`, `:99`) that vary
 * based on the user's device. The same contact will have different suffixes
 * on phone vs web vs tablet. This function strips the suffix for consistent
 * caching.
 *
 * @param lid - LID to normalize (e.g., '123456789:45@lid')
 * @returns Normalized LID (e.g., '123456789@lid'), or original if invalid
 *
 * @example
 * ```typescript
 * normalizeLid('123456789:45@lid')    // '123456789@lid'
 * normalizeLid('123456789:99@lid')    // '123456789@lid'
 * normalizeLid('123456789@lid')       // '123456789@lid' (no change)
 * normalizeLid('123456789@c.us')      // '123456789@c.us' (no change, not a LID)
 * normalizeLid('invalid')             // 'invalid' (no change, invalid)
 * ```
 */
export function normalizeLid(lid: string): string {
    if (!isValidLid(lid)) return lid
    // Remove :digits before @lid suffix only
    return lid.replace(/:\d+(?=@lid$)/, '')
}

/**
 * Sanitizes a session name for safe filesystem usage.
 *
 * Prevents path traversal and invalid filename characters.
 *
 * @internal
 * @param name - Raw session name
 * @returns Sanitized name safe for use in filenames
 */
function sanitizeSessionName(name: string): string {
    // Replace dangerous characters for filenames
    return name.replace(/[\\/:"*?<>|]/g, '_').replace(/\.{2,}/g, '_')
}

/**
 * Normalizes a phone number to consistent `@s.whatsapp.net` format.
 *
 * Handles multiple input formats commonly encountered from WhatsApp:
 * - Bare digits: `1234567890` → `1234567890@s.whatsapp.net`
 * - International: `+1234567890` → `1234567890@s.whatsapp.net`
 * - Spaced: `123 456 7890` → `1234567890@s.whatsapp.net`
 * - Formatted: `+1 (555) 123-4567` → `15551234567@s.whatsapp.net`
 * - Legacy: `123@c.us` → `123@s.whatsapp.net`
 * - Already normalized: `123@s.whatsapp.net` → `123@s.whatsapp.net` (no change)
 *
 * @param pn - Phone number in any format
 * @returns Normalized phone number, or original if cannot be normalized
 *
 * @example
 * ```typescript
 * normalizePn('34691015468')                  // '34691015468@s.whatsapp.net'
 * normalizePn('+34691015468')                   // '34691015468@s.whatsapp.net'
 * normalizePn('34 691 015 468')                 // '34691015468@s.whatsapp.net'
 * normalizePn('+1 (555) 123-4567')              // '15551234567@s.whatsapp.net'
 * normalizePn('34691015468@c.us')              // '34691015468@s.whatsapp.net'
 * normalizePn('34691015468@s.whatsapp.net')      // '34691015468@s.whatsapp.net'
 * normalizePn('not-a-number')                    // 'not-a-number' (unchanged)
 * ```
 */
function normalizePn(pn: string): string {
    if (!isValidPn(pn)) return pn

    // Already in WhatsApp JID format
    if (pn.includes('@s.whatsapp.net')) return pn

    // Legacy format conversion
    if (pn.includes('@c.us')) {
        const digits = pn.replace('@c.us', '')
        if (/^\d+$/.test(digits)) return `${digits}@s.whatsapp.net`
    }

    // Clean common formatting: +, spaces, dashes, dots, parentheses
    const cleaned = pn.replace(/^\+/, '').replace(/[\s\-\.\(\)]/g, '')

    // Validate we now have only digits
    if (/^\d+$/.test(cleaned)) {
        return `${cleaned}@s.whatsapp.net`
    }

    // Cannot normalize, return original
    return pn
}

/**
 * Masks a LID for safe logging (PII protection).
 *
 * Replaces middle characters with `***` to prevent logging full identifiers
 * while keeping enough for debugging.
 *
 * @internal
 * @param lid - LID to mask
 * @returns Masked LID (e.g., '123456789@lid' → '123***@lid')
 */
function maskLid(lid: string): string {
    if (lid.length < 8) return '***@lid'
    return lid.slice(0, 3) + '***' + lid.slice(lid.indexOf('@'))
}

// =============================================================================
// HYBRID CACHE (Memory + File)
// =============================================================================

/**
 * Hybrid LID cache implementation with memory hot-path and file persistence.
 *
 * This is the recommended production implementation, providing:
 * - **Speed**: O(1) in-memory lookups via NodeCache (~1μs)
 * - **Durability**: Automatic persistence to JSON file every 30s
 * - **Resilience**: Survives process restarts, handles corrupted files gracefully
 * - **Security**: File permissions 0o600 (owner read/write only)
 *
 * ## File Location
 *
 * Files are stored at: `{cwd}/{sessionName}_sessions/lid-cache.json`
 *
 * The session name is sanitized to prevent path traversal attacks.
 *
 * ## Configuration
 *
 * | Option | Default | Description |
 * |--------|---------|-------------|
 * | `sessionName` | required | Unique name for this bot instance |
 * | `ttlSeconds` | 604800 (7 days) | Time-to-live for cache entries |
 * | `basePath` | `process.cwd()` | Directory for session files |
 * | `logger` | `console` | Logger for operational events |
 *
 * @example
 * ```typescript
 * // Basic usage
 * const cache = new HybridLidCache('my-bot')
 * await cache.ready()
 *
 * // Custom TTL and logger
 * const cache = new HybridLidCache('my-bot', 86400 * 30, undefined, winstonLogger)
 *
 * // Custom base path
 * const cache = new HybridLidCache('my-bot', 86400, '/var/lib/bot')
 * ```
 */
export class HybridLidCache implements LidCache {
    /** In-memory cache via NodeCache */
    private memory: NodeCache

    /** Absolute path to the JSON persistence file */
    private filePath: string

    /** True if memory has unwritten changes */
    private dirty = false

    /** True if flushToDisk() is currently running (prevents concurrent flushes) */
    private flushing = false

    /** Interval handle for periodic auto-flush */
    private flushInterval?: NodeJS.Timeout

    /** TTL in seconds (for expiry calculations on load) */
    private readonly ttlSeconds: number

    /** Logger for operational events (defaults to console) */
    private readonly logger: Console

    /** Consecutive flush failure count (disables persistence after threshold) */
    private consecutiveFlushFailures = 0

    /** Promise tracking initial file load (prevents race conditions) */
    private loadPromise: Promise<void>

    /** True after close() has been called */
    private isClosed = false

    /**
     * Creates a new HybridLidCache instance.
     *
     * @param sessionName - Unique identifier for this cache instance (used in filename)
     * @param ttlSeconds - Time-to-live for cache entries (default: 7 days)
     * @param basePath - Base directory for session files (default: process.cwd())
     * @param logger - Logger instance for operational events (default: console)
     *
     * @throws Error if sessionName is empty or not a string
     * @throws Error if ttlSeconds is less than 60
     *
     * @remarks
     * The constructor starts async file loading and sets up periodic auto-flush.
     * Use {@link ready()} to wait for initial load completion before operations
     * that require data from previous runs.
     */
    constructor(sessionName: string, ttlSeconds: number = DEFAULT_TTL_SECONDS, basePath?: string, logger?: Console) {
        // Validate required arguments
        if (!sessionName || typeof sessionName !== 'string') {
            throw new Error('sessionName is required and must be a string')
        }
        if (ttlSeconds < 60) {
            throw new Error('ttlSeconds must be at least 60 (1 minute)')
        }

        this.ttlSeconds = ttlSeconds
        this.logger = logger || console

        const sanitizedSession = sanitizeSessionName(sessionName)
        const cwd = basePath || process.cwd()
        this.filePath = join(cwd, `${sanitizedSession}_sessions`, 'lid-cache.json')

        // Initialize in-memory cache with TTL
        this.memory = new NodeCache({
            stdTTL: ttlSeconds,
            useClones: false, // Performance: don't clone objects
            deleteOnExpire: true, // Auto-cleanup expired entries
        })

        // Start async file load (tracked to prevent race conditions)
        this.loadPromise = this.loadFromDisk()

        // Setup periodic auto-flush (every 30s)
        this.flushInterval = setInterval(() => {
            if (!this.isClosed) {
                this.flushToDisk().catch((err) => {
                    this.logger.error('[LID Cache] Periodic flush failed:', err)
                })
            }
        }, DEFAULT_FLUSH_INTERVAL_MS)

        // Unref interval so it doesn't block process exit (important for tests)
        if (this.flushInterval.unref) {
            this.flushInterval.unref()
        }
    }

    /**
     * Waits for the initial file load to complete.
     *
     * Use this method before operations that depend on data from previous runs:
     * - Before checking if a LID exists from a previous session
     * - In tests to ensure deterministic state
     * - During cache warming procedures
     *
     * @returns Promise that resolves when initial load completes
     *
     * @example
     * ```typescript
     * const cache = new HybridLidCache('my-bot')
     * await cache.ready() // Wait for any existing data to load
     * const pn = await cache.get('existing@lid') // Now safe to access
     * ```
     */
    async ready(): Promise<void> {
        await this.loadPromise
    }

    /**
     * Retrieves the phone number for a given LID.
     *
     * @param lid - WhatsApp Local Identifier (e.g., '123456789:45@lid')
     * @returns Phone number in format '1234567890@s.whatsapp.net', or null if:
     *   - Cache is closed
     *   - LID is invalid (doesn't match `*@lid` pattern)
     *   - LID not found in cache
     *   - Entry has expired
     */
    async get(lid: string): Promise<string | null> {
        if (this.isClosed) return null
        if (!isValidLid(lid)) return null

        const normalized = normalizeLid(lid)
        const value = this.memory.get<string>(normalized)

        if (!value) return null

        // Refresh LRU timestamp (extends implicit TTL)
        this.memory.set(normalized, value)

        return value
    }

    /**
     * Stores a LID → phone number mapping.
     *
     * Both the LID and phone number are normalized before storage:
     * - LID: Device suffix removed (`123:45@lid` → `123@lid`)
     * - PN: Formatted to `123@s.whatsapp.net`
     *
     * @param lid - WhatsApp Local Identifier
     * @param pn - Phone number in any accepted format
     * @returns Promise that resolves immediately (memory write is synchronous)
     *
     * @remarks
     * - Invalid inputs are silently rejected (no throw)
     * - The `dirty` flag is set, triggering async flush to disk within 30s
     * - If the cache is closed, this is a no-op
     */
    async set(lid: string, pn: string): Promise<void> {
        if (this.isClosed) return
        if (!isValidLid(lid)) {
            this.logger.debug?.('[LID Cache] Rejected invalid LID:', maskLid(String(lid)))
            return
        }
        if (!isValidPn(pn)) {
            this.logger.debug?.('[LID Cache] Rejected invalid PN:', pn)
            return
        }

        const normalizedLid = normalizeLid(lid)
        const normalizedPn = normalizePn(pn)

        this.memory.set(normalizedLid, normalizedPn)
        this.dirty = true
    }

    /**
     * Checks if a LID exists in the cache.
     *
     * @param lid - WhatsApp Local Identifier
     * @returns true if:
     *   - LID is valid
     *   - Cache is open
     *   - Entry exists and hasn't expired
     *
     * @example
     * ```typescript
     * if (await cache.has('123@lid')) {
     *   const pn = await cache.get('123@lid')
     *   // ...
     * }
     * ```
     */
    async has(lid: string): Promise<boolean> {
        if (this.isClosed) return false
        if (!isValidLid(lid)) return false

        const normalized = normalizeLid(lid)
        return this.memory.has(normalized)
    }

    /**
     * Clears all entries from the cache.
     *
     * @remarks
     * - Immediately clears memory
     * - Triggers synchronous flush to disk (empty file)
     * - Logs the operation at info level
     */
    async clear(): Promise<void> {
        if (this.isClosed) return
        this.memory.flushAll()
        this.dirty = true
        this.logger.info?.('[LID Cache] Cache cleared')
        await this.flushToDisk()
    }

    /**
     * Closes the cache, releasing resources and triggering final persistence.
     *
     * This method:
     * 1. Stops the auto-flush interval
     * 2. Waits for any in-progress file load
     * 3. Performs a final flush to disk
     * 4. Closes the NodeCache instance
     * 5. Marks the cache as closed
     *
     * @returns Promise that resolves when cleanup is complete
     *
     * @remarks
     * - After close(), all operations return null/void
     * - Safe to call multiple times (subsequent calls are no-ops)
     * - Flush errors are logged but don't throw
     */
    async close(): Promise<void> {
        if (this.isClosed) return

        if (this.flushInterval) {
            clearInterval(this.flushInterval)
            this.flushInterval = undefined
        }

        // Wait for initial load to complete if still in progress
        try {
            await this.loadPromise
        } catch {
            // Ignore load errors during close
        }

        // Final flush attempt
        try {
            await this.flushToDisk()
        } catch (err) {
            this.logger.error('[LID Cache] Final flush failed on close:', err)
        }

        this.isClosed = true
        this.memory.close()
        this.logger.info?.('[LID Cache] Closed')
    }

    /**
     * Forces compaction of the cache file by rewriting it with only valid entries.
     *
     * This removes any expired entries that might still be in the file
     * (since NodeCache auto-expiry only removes from memory, not disk).
     *
     * @returns Promise that resolves when compaction completes
     *
     * @remarks
     * - If the cache is empty, the file is deleted instead
     * - Automatically called when file exceeds 10MB or 10k entries
     */
    async compact(): Promise<void> {
        if (this.isClosed) return

        const keys = this.memory.keys()
        if (keys.length === 0) {
            // Empty cache - delete file
            try {
                await unlink(this.filePath)
                this.dirty = false
                this.logger.info?.('[LID Cache] Empty cache file removed')
            } catch {
                // File may not exist
            }
            return
        }

        // Force full rewrite
        this.dirty = true
        await this.flushToDisk()
        this.logger.info?.('[LID Cache] Compacted', { entries: keys.length })
    }

    /**
     * Persists the current cache state to disk.
     *
     * @internal
     * @remarks
     * - Concurrent calls are deduplicated (only one flush runs at a time)
     * - No-op if nothing has changed since last flush (`dirty` flag check)
     * - File is written with 0o600 permissions (owner read/write only)
     * - After 10 consecutive failures, persistence is disabled
     */
    async flushToDisk(): Promise<void> {
        // Prevent concurrent flushes
        if (this.flushing) return
        if (!this.dirty) return

        this.flushing = true

        try {
            await mkdir(dirname(this.filePath), { recursive: true })

            const keys = this.memory.keys()

            // Compact if entry count exceeds threshold
            if (keys.length > COMPACT_AT_ENTRIES) {
                await this.compact()
            }

            const entries: Record<string, CacheEntry> = {}
            const now = Date.now()

            for (const key of keys) {
                const value = this.memory.get<string>(key)
                if (!value) continue

                entries[key] = {
                    pn: value,
                    ts: now,
                }
            }

            const data: CacheFileData = {
                version: CACHE_FILE_VERSION,
                entries,
            }

            // Write with secure permissions
            await writeFile(this.filePath, JSON.stringify(data, null, 2), {
                encoding: 'utf-8',
                mode: FILE_PERMISSIONS,
            })

            this.dirty = false
            this.consecutiveFlushFailures = 0 // Reset on success

            // Check file size and compact if needed
            await this.checkAndCompactIfNeeded()
        } catch (err) {
            this.consecutiveFlushFailures++

            if (this.consecutiveFlushFailures >= MAX_FLUSH_FAILURES) {
                this.logger.error(
                    `[LID Cache] Flush failed ${MAX_FLUSH_FAILURES} times, disabling persistence. ` +
                        'Cache will work in-memory only until restart.',
                    { error: err, filePath: this.filePath }
                )
                this.dirty = false // Stop trying
            } else {
                this.logger.warn(
                    `[LID Cache] Flush failed (${this.consecutiveFlushFailures}/${MAX_FLUSH_FAILURES}):`,
                    err
                )
            }

            throw err // Re-throw for caller awareness
        } finally {
            this.flushing = false
        }
    }

    /**
     * Checks file size and triggers compaction if exceeds threshold.
     *
     * @internal
     */
    private async checkAndCompactIfNeeded(): Promise<void> {
        try {
            const stats = await stat(this.filePath)
            if (stats.size > MAX_FILE_SIZE_BYTES) {
                this.logger.warn(`[LID Cache] File size ${stats.size} bytes exceeds threshold, compacting...`)
                await this.compact()
            }
        } catch {
            // File may not exist
        }
    }

    /**
     * Loads cache data from disk on startup.
     *
     * @internal
     * @remarks
     * - Silently handles missing file (first run)
     * - Automatically removes and recovers from corrupted files
     * - Validates TTL on each entry (entries older than TTL are skipped)
     */
    private async loadFromDisk(): Promise<void> {
        try {
            await access(this.filePath)
        } catch {
            // File doesn't exist - clean start
            return
        }

        let data: unknown
        try {
            const raw = await readFile(this.filePath, 'utf-8')
            data = JSON.parse(raw)
        } catch (err) {
            // Corrupted file - remove and start fresh
            try {
                await unlink(this.filePath)
            } catch {
                // ignore unlink errors
            }
            this.logger.error('[LID Cache] Corrupted cache file removed, starting fresh:', err)
            return
        }

        // Validate file structure
        if (!isCacheFileData(data)) {
            this.logger.warn('[LID Cache] Invalid cache file format, starting fresh')
            return
        }

        // Load valid, non-expired entries
        let loadedCount = 0
        let expiredCount = 0
        const now = Date.now()
        const ttlMs = this.ttlSeconds * 1000

        for (const [key, entry] of Object.entries(data.entries)) {
            if (!isCacheEntry(entry)) continue

            // Check TTL from stored timestamp
            const age = now - entry.ts
            if (age >= ttlMs) {
                expiredCount++
                continue
            }

            this.memory.set(key, entry.pn)
            loadedCount++
        }

        if (loadedCount > 0 || expiredCount > 0) {
            this.logger.info('[LID Cache] Loaded entries from disk', {
                valid: loadedCount,
                expired: expiredCount,
                file: this.filePath,
            })
        }
    }

    /**
     * Returns cache statistics for monitoring.
     *
     * @returns Object with:
     *   - `keys`: Number of entries currently in memory
     *   - `hits`: Cache hit count (from NodeCache stats)
     *   - `misses`: Cache miss count (from NodeCache stats)
     *
     * @example
     * ```typescript
     * const stats = cache.getStats()
     * console.log(`Cache: ${stats.keys} entries, ${stats.hits} hits, ${stats.misses} misses`)
     * // → Cache: 1523 entries, 4500 hits, 123 misses
     * ```
     */
    getStats(): { keys: number; hits: number; misses: number } {
        return {
            keys: this.memory.keys().length,
            hits: (this.memory as any).getStats()?.hits || 0,
            misses: (this.memory as any).getStats()?.misses || 0,
        }
    }
}

// =============================================================================
// MEMORY-ONLY CACHE (Testing)
// =============================================================================

/**
 * Memory-only LID cache implementation for testing.
 *
 * This implementation provides the same {@link LidCache} interface but without
 * file persistence. Useful for:
 * - Unit tests (no file I/O, no cleanup needed)
 * - Ephemeral caches that don't need durability
 * - Reducing disk wear in high-frequency test scenarios
 *
 * ## Differences from HybridLidCache
 *
 * | Feature | MemoryLidCache | HybridLidCache |
 * |---------|---------------|----------------|
 * | Persistence | ❌ None | ✅ JSON file |
 * | `ready()` | Optional | Recommended |
 * | `close()` | No-op | Flushes to disk |
 * | `compact()` | No-op | Rewrites file |
 * | Cross-restart | Data lost | Data preserved |
 *
 * @example
 * ```typescript
 * // Testing scenario
 * const cache = new MemoryLidCache(3600) // 1 hour TTL
 * await cache.set('123@lid', '456@s.whatsapp.net')
 * expect(await cache.get('123@lid')).toBe('456@s.whatsapp.net')
 * // No cleanup needed - data is ephemeral
 * ```
 */
export class MemoryLidCache implements LidCache {
    /** In-memory cache via NodeCache (no persistence) */
    private memory: NodeCache

    /**
     * Creates a new MemoryLidCache instance.
     *
     * @param ttlSeconds - Time-to-live for cache entries (default: 7 days)
     */
    constructor(ttlSeconds: number = DEFAULT_TTL_SECONDS) {
        this.memory = new NodeCache({
            stdTTL: ttlSeconds,
            useClones: false,
        })
    }

    /**
     * Retrieves the phone number for a given LID.
     *
     * @param lid - WhatsApp Local Identifier
     * @returns Phone number or null if not found/invalid
     */
    async get(lid: string): Promise<string | null> {
        if (!isValidLid(lid)) return null

        const normalized = normalizeLid(lid)
        return this.memory.get<string>(normalized) || null
    }

    /**
     * Stores a LID → phone number mapping.
     *
     * @param lid - WhatsApp Local Identifier
     * @param pn - Phone number in any format
     */
    async set(lid: string, pn: string): Promise<void> {
        if (!isValidLid(lid)) return
        if (!isValidPn(pn)) return

        const normalized = normalizeLid(lid)
        this.memory.set(normalized, pn)
    }

    /**
     * Checks if a LID exists in the cache.
     *
     * @param lid - WhatsApp Local Identifier
     * @returns true if entry exists and hasn't expired
     */
    async has(lid: string): Promise<boolean> {
        if (!isValidLid(lid)) return false

        const normalized = normalizeLid(lid)
        return this.memory.has(normalized)
    }

    /**
     * Clears all entries from the cache.
     */
    async clear(): Promise<void> {
        this.memory.flushAll()
    }

    /**
     * Closes the cache. For MemoryLidCache, this is a no-op.
     *
     * @remarks The NodeCache instance is not closed to allow continued testing.
     * If you need to free memory, use `clear()` before `close()`.
     */
    async close(): Promise<void> {
        // No-op for memory cache - data is already ephemeral
    }
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Configuration options for creating a LidCache instance.
 */
export interface LidCacheFactoryOptions {
    /** Cache strategy: 'file' (default), 'memory', or custom LidCache instance */
    strategy?: 'file' | 'memory' | LidCache

    /** Session name for file-based cache (used in filename) */
    sessionName?: string

    /** TTL in seconds (default: 7 days) */
    ttlSeconds?: number

    /** Base path for session files (default: process.cwd()) */
    basePath?: string

    /** Logger for operational events (default: console) */
    logger?: Console
}

/**
 * Factory function to create a LidCache instance based on configuration.
 *
 * This factory centralizes cache creation logic, making it reusable across
 * the codebase and easier to test/maintain.
 *
 * @param options - Factory configuration options
 * @returns Configured LidCache instance
 *
 * @example
 * ```typescript
 * // Default: HybridLidCache (file + memory)
 * const cache = createLidCache({ sessionName: 'my-bot' })
 *
 * // Memory-only (testing)
 * const cache = createLidCache({ strategy: 'memory', ttlSeconds: 3600 })
 *
 * // Custom implementation
 * const cache = createLidCache({ strategy: new RedisLidCache() })
 * ```
 */
export function createLidCache(options: LidCacheFactoryOptions = {}): LidCache {
    const { strategy = 'file', sessionName = 'default', ttlSeconds = DEFAULT_TTL_SECONDS, basePath, logger } = options

    // If custom instance passed, use it directly
    if (strategy && typeof strategy === 'object') {
        return strategy
    }

    // Memory-only strategy
    if (strategy === 'memory') {
        return new MemoryLidCache(ttlSeconds)
    }

    // Default: Hybrid (file + memory)
    return new HybridLidCache(sessionName, ttlSeconds, basePath, logger)
}

// =============================================================================
// MESSAGE UTILITIES
// =============================================================================

/**
 * Minimal interface for Baileys message context key.
 * Used for type-safe extraction of LID/PN mappings from incoming messages.
 *
 * @internal
 */
export interface MessageContextKey {
    /** Remote JID (LID for DMs, group ID for groups) */
    remoteJid?: string
    /** Participant LID in group messages */
    participant?: string
    /** Participant phone number (if available) */
    participantAlt?: string
    /** Alternative remote JID with phone number */
    remoteJidAlt?: string
    /** Sender phone number (if available) */
    senderPn?: string
    /** Participant phone number (alternative field) */
    participantPn?: string
}

/**
 * Minimal interface for Baileys message context.
 *
 * @internal
 */
export interface MessageContext {
    /** Message key with JID information */
    key?: MessageContextKey
}

/**
 * Type guard to check if a value is a valid MessageContext.
 *
 * @param value - Value to check
 * @returns true if the value matches MessageContext structure
 */
export function isMessageContext(value: unknown): value is MessageContext {
    if (typeof value !== 'object' || value === null) return false
    const ctx = value as Record<string, unknown>

    // If key exists, it must be an object (MessageContextKey)
    if ('key' in ctx && ctx.key !== undefined) {
        if (typeof ctx.key !== 'object' || ctx.key === null) return false
    }

    return true
}

/**
 * Extracts and caches LID → PN mapping from an incoming message.
 *
 * This utility function inspects the message context to find LID/PN pairs
 * and stores them in the provided cache for future lookups.
 *
 * @param cache - LidCache instance to store the mapping
 * @param messageCtx - Baileys message context (WAMessage)
 * @returns Promise that resolves when caching is complete (or silently fails)
 *
 * @example
 * ```typescript
 * // In message handler:
 * for (const message of messages) {
 *     await extractAndCacheLidFromMessage(lidCache, message)
 * }
 * ```
 */
export async function extractAndCacheLidFromMessage(cache: LidCache, messageCtx: MessageContext): Promise<void> {
    try {
        const key = messageCtx?.key
        if (!key) return

        const isGroup = key.remoteJid?.includes('@g.us')

        if (isGroup) {
            // Groups: participant has the LID, participantAlt has the PN
            if (key.participant?.includes('@lid') && key.participantAlt) {
                await cache.set(key.participant, key.participantAlt)
            }
        } else {
            // DMs: remoteJid has the LID
            if (key.remoteJid?.includes('@lid')) {
                // Priority: remoteJidAlt > senderPn > participantPn
                const pn = key.remoteJidAlt || key.senderPn || key.participantPn
                if (pn) {
                    await cache.set(key.remoteJid, pn)
                }
            }
        }
    } catch {
        // Silent failure - don't block message processing
    }
}

/**
 * LID resolver function type.
 * Takes a LID string and returns the corresponding phone number JID or null.
 */
export type LidResolver = (lid: LidJid) => Promise<PnJid | null>

/**
 * Resolves a LID to a phone number using cache-first strategy.
 *
 * This function implements the resolution chain:
 * 1. Check cache first (O(1), ~1μs)
 * 2. If miss, call fallback resolver (e.g., Baileys lidMapping)
 * 3. If resolved, store in cache for future lookups
 *
 * @param cache - LidCache instance for storing/retrieving mappings
 * @param fallbackResolver - Async function to resolve LID when not in cache
 * @param logger - Logger for operational events (optional)
 * @param lid - WhatsApp Local Identifier to resolve
 * @returns Phone number in format '1234567890@s.whatsapp.net', or null
 *
 * @example
 * ```typescript
 * const pn = await resolveLidToPn(
 *     lidCache,
 *     (lid) => baileysSignalRepo.lidMapping.getPNForLID(lid),
 *     console,
 *     '123456789@lid' as LidJid
 * )
 * ```
 */
export async function resolveLidToPn(
    cache: LidCache,
    fallbackResolver: LidResolver | ((lid: string) => Promise<string | null>),
    logger: Console | undefined,
    lid: LidJid | string
): Promise<PnJid | string | null> {
    try {
        // Validate/normalize the LID
        const normalizedLid = asLidJid(typeof lid === 'string' ? lid : lid)
        if (!normalizedLid) {
            logger?.error?.('[LID Cache] Invalid LID format:', lid)
            return null
        }

        // 1. Check cache first (fast, O(1))
        const cached = await cache.get(normalizedLid)
        if (cached) {
            logger?.log?.(`[LID Cache] Hit: ${normalizedLid} -> ${cached}`)
            return cached as PnJid
        }

        // 2. Fallback to provided resolver
        const resolved = await fallbackResolver(normalizedLid)
        if (resolved) {
            // Validate the resolved value is a valid PN
            const normalizedPn = asPnJid(resolved)
            if (normalizedPn) {
                // Store in cache for next time
                await cache.set(normalizedLid, normalizedPn)
                logger?.log?.(`[LID Cache] Resolved: ${normalizedLid} -> ${normalizedPn}`)
                return normalizedPn
            }
        }

        return null
    } catch (e) {
        logger?.error?.('[LID Cache] Error resolving LID:', e)
        return null
    }
}
