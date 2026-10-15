/**
 * LAYER: Infrastructure
 * Contains: ReleaseTmp, cleanSessionFiles
 * Rules: Removes only explicitly owned temporary artifacts, never authentication state.
 * BigO: O(n) score:3
 * keywords: [ReleaseTmp, SessionCleanup, AuthenticationState]
 * GOAL: Clean provider-owned temporary artifacts without deleting current or future Baileys keys.
 */
import { existsSync, type Dirent } from 'fs'
import { readdir, unlink } from 'fs/promises'
import { join } from 'path'

// Positive ownership rule: authentication JSON, arbitrary .tmp files and unknown
// future key categories must survive. Only this reserved artifact namespace is disposable.
const OWNED_TEMP_FILE = /^builderbot-temp-[a-zA-Z0-9_-]+\.tmp$/

/**
 * One-shot cleanup of explicitly owned `builderbot-temp-<id>.tmp` files.
 * All credentials, Signal keys, caches and unknown files are preserved.
 * @param sessionName - Session directory relative to `process.cwd()`
 */
export const cleanSessionFiles = async (sessionName: string): Promise<void> => {
    const sessionPath = join(process.cwd(), sessionName)
    let files: Dirent[]
    try {
        files = await readdir(sessionPath, { withFileTypes: true })
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
        throw error
    }

    for (const file of files) {
        if (!file.isFile() || !OWNED_TEMP_FILE.test(file.name)) continue
        try {
            await unlink(join(sessionPath, file.name))
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
    }
}

/** Starts non-overlapping cleanup passes. The caller owns and must clear the timer. */
export const releaseTmp = async (sessionName: string, ms: number): Promise<NodeJS.Timeout | undefined> => {
    if (!Number.isFinite(ms) || ms <= 0 || !existsSync(join(process.cwd(), sessionName))) return undefined

    let cleaning = false
    const timer = setInterval(async () => {
        if (cleaning) return
        cleaning = true
        try {
            await cleanSessionFiles(sessionName)
        } catch (error) {
            console.error('[Baileys] Temporary artifact cleanup failed:', error)
        } finally {
            cleaning = false
        }
    }, ms)
    timer.unref?.()
    return timer
}
