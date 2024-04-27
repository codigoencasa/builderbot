import { existsSync } from 'fs'
import { readdir, unlink } from 'fs/promises'
import { join } from 'path'

const keepFiles = ['creds.json', 'baileys_store.json', 'app-state-sync']

/**
 * @alpha
 * @param sessionName
 */
export const releaseTmp = async (sessionName: string, ms: number) => {
    const PATH_SRC = join(process.cwd(), sessionName)

    if (!existsSync(PATH_SRC)) {
        return
    }

    const filesToClean = await readdir(PATH_SRC)

    const deleteFiles = async () => {
        for (const iterator of filesToClean) {
            const checkFile = keepFiles.some((i) => iterator.includes(i))
            if (!checkFile) {
                try {
                    const fileToDelete = join(PATH_SRC, iterator)
                    if (!existsSync(fileToDelete)) {
                        return
                    }
                    await unlink(fileToDelete)
                    console.log(`🏷️ Clean:`, iterator)
                } catch (e) {
                    console.log(`Error:`, e)
                }
            }
        }
    }

    setInterval(deleteFiles, ms)
}
