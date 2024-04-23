import { readdir, unlink } from 'fs/promises'
import { join } from 'path'

const keepFiles = ['creds.json', 'baileys_store.json', 'app-state-sync']

/**
 * @alpha
 * @param sessionName
 */
export const releaseTmp = async (sessionName: string, ms: number) => {
    const PATH_SRC = join(process.cwd(), sessionName)

    const filesToClean = await readdir(PATH_SRC)

    const deleteFiles = async () => {
        for (const iterator of filesToClean) {
            const checkFile = keepFiles.some((i) => iterator.includes(i))
            if (!checkFile) {
                const fileToDelete = join(PATH_SRC, iterator)
                await unlink(fileToDelete)
                console.log(`🏷️ Clean:`, iterator)
            }
        }
    }

    setInterval(deleteFiles, ms)
}
