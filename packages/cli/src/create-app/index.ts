import * as fs from 'fs-extra'

/**
 * Copy files
 * @param from Source path
 * @param to Destination path
 */
const copyFiles = async (from: string, to: string): Promise<void> => {
    try {
        await fs.copy(from, to)
    } catch (err) {
        console.error(err)
    }
}

/**
 * Copiar directorio con archivos
 * @param fromDir Source directory path
 * @param toDir Destination directory path
 */
const copyBaseApp = async (fromDir: string = process.cwd(), toDir: string = process.cwd()): Promise<void> => {
    const BASE_APP_PATH_FROM: string = fromDir
    const BASE_APP_PATH_TO: string = toDir
    await copyFiles(BASE_APP_PATH_FROM, BASE_APP_PATH_TO)
}

export { copyBaseApp }
