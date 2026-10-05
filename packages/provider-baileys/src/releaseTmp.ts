/**
 * LAYER: Infrastructure
 * Contains: ReleaseTmp, cleanSessionFiles
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(n) score:3
 * keywords: [ReleaseTmp, cleanSessionFiles]
 * GOAL: Own the "release tmp" concern of the provider-baileys package.
 */
import { existsSync } from 'fs'
import { readdir, unlink } from 'fs/promises'
import { join } from 'path'

const keepFiles = ['creds.json', 'baileys_store.json', 'app-state-sync', 'session']

/**
 * Removes every non-essential file inside a session directory in a single pass.
 *
 * Files listed in {@link keepFiles} (credentials and app-state) are preserved.
 *
 * @alpha
 * @param sessionName - Session directory name, relative to `process.cwd()`
 */
export const cleanSessionFiles = async (sessionName: string): Promise<void> => {
    const PATH_SRC = join(process.cwd(), sessionName)

    if (!existsSync(PATH_SRC)) return

    let filesToClean: string[]
    try {
        filesToClean = await readdir(PATH_SRC)
    } catch (e) {
        console.log(`Error:`, e)
        return
    }

    for (const iterator of filesToClean) {
        const checkFile = keepFiles.some((i) => iterator.includes(i))
        if (checkFile) continue

        try {
            const fileToDelete = join(PATH_SRC, iterator)
            if (!existsSync(fileToDelete)) continue
            await unlink(fileToDelete)
            console.log(`🏷️ Clean:`, iterator)
        } catch (e) {
            console.log(`Error:`, e)
        }
    }
}

/**
 * Starts a periodic cleanup of a session directory.
 *
 * The returned timer is `unref()`ed so it never keeps the process alive.
 *
 * @alpha
 * @param sessionName - Session directory name, relative to `process.cwd()`
 * @param ms - Interval between cleanup passes, in milliseconds
 * @returns The interval handle, or `undefined` if the session directory does not exist
 */
export const releaseTmp = async (sessionName: string, ms: number): Promise<NodeJS.Timeout | undefined> => {
    const PATH_SRC = join(process.cwd(), sessionName)

    if (!existsSync(PATH_SRC)) {
        return undefined
    }

    const idTimer = setInterval(() => {
        cleanSessionFiles(sessionName).catch((e) => console.log(`Error:`, e))
    }, ms)

    if (typeof idTimer.unref === 'function') {
        idTimer.unref()
    }

    return idTimer
}
