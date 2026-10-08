/**
 * LAYER: Infrastructure
 * Contains: SessionCleanupTests
 * Rules: Uses only isolated test-owned files.
 * BigO: O(n) score:3
 * keywords: [SessionCleanupTests, AuthenticationState]
 * GOAL: Prove cleanup never deletes authentication material or unknown application files.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'

import { cleanSessionFiles, releaseTmp } from '../src/releaseTmp'

const SESSION = 'releasetmp-test_sessions'
const dir = join(process.cwd(), SESSION)

// Include both known Baileys categories and unknown/future files.
const preserved = [
    'creds.json',
    'session-123.json',
    'pre-key-1.json',
    'sender-key-123.json',
    'sender-key-memory-123.json',
    'lid-mapping-123.json',
    'device-list-123.json',
    'tctoken-123.json',
    'app-state-sync-key-123.json',
    'lid-cache.json',
    'future-auth-category-123.json',
    'application.txt',
    'application.tmp',
]

describe('#releaseTmp', () => {
    beforeEach(() => {
        mkdirSync(dir, { recursive: true })
    })

    afterEach(() => {
        jest.restoreAllMocks()
        rmSync(dir, { recursive: true, force: true })
    })

    test('removes only explicitly owned temporary files, preserving all auth and unknown files', async () => {
        for (const file of preserved) writeFileSync(join(dir, file), '{}')
        writeFileSync(join(dir, 'builderbot-temp-preview.tmp'), 'temporary')
        mkdirSync(join(dir, 'builderbot-temp-directory.tmp'))

        await cleanSessionFiles(SESSION)

        for (const file of preserved) expect(existsSync(join(dir, file))).toBe(true)
        expect(existsSync(join(dir, 'builderbot-temp-preview.tmp'))).toBe(false)
        expect(existsSync(join(dir, 'builderbot-temp-directory.tmp'))).toBe(true)
    })

    test('cleanSessionFiles is a no-op for a missing directory', async () => {
        await expect(cleanSessionFiles('does-not-exist_sessions')).resolves.toBeUndefined()
    })

    test('releaseTmp returns undefined for a missing directory or invalid interval', async () => {
        await expect(releaseTmp('does-not-exist_sessions', 1000)).resolves.toBeUndefined()
        for (const ms of [0, -1, NaN, Infinity]) {
            await expect(releaseTmp(SESSION, ms)).resolves.toBeUndefined()
        }
    })

    test('periodic cleanup preserves keys created after the timer starts', async () => {
        const intervalSpy = jest.spyOn(global, 'setInterval')
        const timer = await releaseTmp(SESSION, 60_000)
        try {
            expect(timer).toBeDefined()
            expect(timer!.hasRef()).toBe(false)
            writeFileSync(join(dir, 'pre-key-new.json'), '{}')
            writeFileSync(join(dir, 'builderbot-temp-preview.tmp'), 'temporary')

            // Invoke the real async pass deterministically, without sleeps.
            await intervalSpy.mock.calls[0][0]()

            expect(existsSync(join(dir, 'pre-key-new.json'))).toBe(true)
            expect(existsSync(join(dir, 'builderbot-temp-preview.tmp'))).toBe(false)
        } finally {
            if (timer) clearInterval(timer)
        }
    })
})
