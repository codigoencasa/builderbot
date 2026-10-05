import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'

import { cleanSessionFiles, releaseTmp } from '../src/releaseTmp'

const SESSION = 'releasetmp-test_sessions'
const dir = join(process.cwd(), SESSION)

describe('#releaseTmp', () => {
    beforeEach(() => {
        rmSync(dir, { recursive: true, force: true })
    })

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true })
    })

    test('cleanSessionFiles removes non-essential files and keeps credentials', async () => {
        mkdirSync(dir, { recursive: true })
        writeFileSync(join(dir, 'junk.txt'), 'x')
        writeFileSync(join(dir, 'creds.json'), '{}')
        writeFileSync(join(dir, 'baileys_store.json'), '{}')

        await cleanSessionFiles(SESSION)

        expect(existsSync(join(dir, 'junk.txt'))).toBe(false)
        expect(existsSync(join(dir, 'creds.json'))).toBe(true)
        expect(existsSync(join(dir, 'baileys_store.json'))).toBe(true)
    })

    test('cleanSessionFiles is a no-op for a missing directory', async () => {
        await expect(cleanSessionFiles('does-not-exist_sessions')).resolves.toBeUndefined()
    })

    test('releaseTmp returns undefined for a missing directory', async () => {
        await expect(releaseTmp('does-not-exist_sessions', 1000)).resolves.toBeUndefined()
    })

    test('releaseTmp cleans periodically and returns a timer', async () => {
        mkdirSync(dir, { recursive: true })
        writeFileSync(join(dir, 'junk.txt'), 'x')

        const timer = await releaseTmp(SESSION, 30)
        expect(timer).toBeDefined()

        await new Promise((resolve) => setTimeout(resolve, 150))

        expect(existsSync(join(dir, 'junk.txt'))).toBe(false)

        if (timer) clearInterval(timer)
    })
})
