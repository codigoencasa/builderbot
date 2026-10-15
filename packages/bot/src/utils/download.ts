/**
 * LAYER: Infrastructure
 * Contains: generalDownload / downloadFile — streaming media download to disk
 * Rules: Wraps http/https and the filesystem. No business rules.
 * BigO: O(n) score:3
 * keywords: [generalDownload, downloadFile, fileTypeFromFile]
 * GOAL: Fetch remote media and persist it safely to a local path.
 */
import { randomBytes } from 'crypto'
import { http, https } from 'follow-redirects'
import { rename, createWriteStream, existsSync, mkdirSync } from 'fs'
import type { IncomingMessage } from 'http'
import mimeTypes from 'mime-types'
import { tmpdir } from 'os'
import { extname, basename, parse, join } from 'path'

/**
 * Extraer el mimetype from buffer
 * @param response - La respuesta HTTP
 * @returns Un objeto con el tipo y la extensión del archivo
 */
const fileTypeFromFile = async (response: IncomingMessage): Promise<{ type: string | null; ext: string | false }> => {
    const type = response.headers['content-type'] ?? ''
    const ext = mimeTypes.extension(type)
    return {
        type,
        ext,
    }
}

/**
 * Generar nombre único para evitar colisiones en descargas concurrentes
 * @param originalName - Nombre original del archivo
 * @returns Nombre único con timestamp y hash aleatorio
 */
const generateUniqueFileName = (originalName: string): string => {
    const timestamp = Date.now()
    const randomHash = randomBytes(4).toString('hex')
    return `${originalName}_${timestamp}_${randomHash}`
}

/**
 * Verificar y crear directorio si no existe
 * @param dirPath - Ruta del directorio
 */
const ensureDirectoryExists = (dirPath: string): void => {
    try {
        if (!existsSync(dirPath)) {
            mkdirSync(dirPath, { recursive: true })
        }
    } catch (error) {
        console.warn(`Warning: Could not create directory ${dirPath}:`, error)
    }
}

/**
 * Verificar si un archivo existe con retry
 * @param filePath - Ruta del archivo
 * @param maxRetries - Número máximo de reintentos
 * @returns true si el archivo existe
 */
const fileExistsWithRetry = (filePath: string, maxRetries = 3): boolean => {
    for (let i = 0; i < maxRetries; i++) {
        if (existsSync(filePath)) {
            return true
        }
        // Pequeña espera para permitir que operaciones de filesystem se completen
        if (i < maxRetries - 1) {
            const sleepMs = 10 + Math.random() * 20 // 10-30ms aleatorio
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, sleepMs)
        }
    }
    return false
}

/**
 * Realizar rename con manejo de colisiones
 * @param sourcePath - Ruta origen
 * @param targetPath - Ruta destino
 * @returns Promise<string> - Ruta final del archivo
 */
const safeRename = (sourcePath: string, targetPath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        // Verificar que el archivo origen existe
        if (!fileExistsWithRetry(sourcePath)) {
            reject(new Error(`Source file does not exist: ${sourcePath}`))
            return
        }

        let finalPath = targetPath
        let attempt = 0
        const maxAttempts = 5

        const tryRename = () => {
            rename(sourcePath, finalPath, (err) => {
                if (err) {
                    // Si el archivo destino ya existe, generar nuevo nombre
                    if (err.code === 'EEXIST' && attempt < maxAttempts) {
                        attempt++
                        const parsedPath = parse(targetPath)
                        finalPath = join(parsedPath.dir, `${parsedPath.name}_${attempt}${parsedPath.ext}`)
                        tryRename()
                        return
                    }

                    // Si el archivo origen no existe (fue movido por otro proceso)
                    if (err.code === 'ENOENT') {
                        reject(new Error(`Source file was moved by another process: ${sourcePath}`))
                        return
                    }

                    reject(new Error(`Rename failed: ${err.message} (${err.code})`))
                } else {
                    resolve(finalPath)
                }
            })
        }

        tryRename()
    })
}

/**
 * Descargar archivo binario en tmp con manejo mejorado de concurrencia
 * @param url - La URL del archivo a descargar
 * @param pathToSave - Directorio donde guardar (opcional)
 * @param headers - Headers adicionales (opcional)
 * @returns La ruta al archivo descargado
 */
const generalDownload = async (url: string, pathToSave?: string, headers?: Record<string, any>): Promise<string> => {
    const checkIsLocal = existsSync(url)
    const downloadDir = pathToSave ?? tmpdir()

    // Asegurar que el directorio existe
    ensureDirectoryExists(downloadDir)

    const handleDownload = (): Promise<{ response: IncomingMessage; fullPath: string }> => {
        try {
            const checkProtocol = url.startsWith('https')
            const handleHttp = checkProtocol ? https : http
            const fileName = basename(checkProtocol ? new URL(url).pathname : url)
            const name = parse(fileName).name

            // 🔥 SOLUCIÓN: Generar nombre único para evitar colisiones
            const uniqueName = generateUniqueFileName(name)
            const fullPath = join(downloadDir, uniqueName)

            if (checkIsLocal) {
                /**
                 * From Local
                 */
                return new Promise((res) => {
                    const response = {
                        headers: {
                            'content-type': mimeTypes.contentType(extname(url)) || '',
                        },
                    } as unknown as IncomingMessage
                    res({ response, fullPath: url })
                })
            } else {
                /**
                 * From URL con manejo mejorado de errores
                 */
                return new Promise((res, rej) => {
                    const options = {
                        headers: headers ?? {},
                        timeout: 30000, // 30 segundos timeout
                    }

                    let downloadCompleted = false
                    const file = createWriteStream(fullPath)

                    const request = handleHttp.get(url, options, function (response) {
                        // Verificar código de respuesta HTTP
                        if (response.statusCode !== 200) {
                            file.close()
                            rej(new Error(`HTTP ${response.statusCode}: ${response.statusMessage} for ${url}`))
                            return
                        }

                        response.pipe(file)

                        file.on('finish', function () {
                            if (!downloadCompleted) {
                                downloadCompleted = true
                                file.close(() => {
                                    // Verificar que el archivo realmente existe
                                    if (fileExistsWithRetry(fullPath)) {
                                        res({ response, fullPath })
                                    } else {
                                        rej(new Error(`File was not created successfully: ${fullPath}`))
                                    }
                                })
                            }
                        })

                        file.on('error', function (err) {
                            if (!downloadCompleted) {
                                downloadCompleted = true
                                file.close()
                                // Limpiar archivo parcial
                                try {
                                    if (existsSync(fullPath)) {
                                        require('fs').unlinkSync(fullPath)
                                    }
                                } catch (cleanupErr) {
                                    console.warn(`Could not cleanup partial file ${fullPath}:`, cleanupErr)
                                }
                                rej(new Error(`File write error: ${err.message}`))
                            }
                        })
                    })

                    request.on('error', function (err) {
                        if (!downloadCompleted) {
                            downloadCompleted = true
                            file.close()
                            rej(new Error(`Download error for ${url}: ${err.message}`))
                        }
                    })

                    // Timeout para la request
                    request.setTimeout(30000, () => {
                        if (!downloadCompleted) {
                            downloadCompleted = true
                            request.destroy()
                            file.close()
                            rej(new Error(`Download timeout for ${url}`))
                        }
                    })
                })
            }
        } catch (err) {
            throw new Error(`Failed to setup download for ${url}: ${err.message}`)
        }
    }

    const handleFile = async (pathInput: string, ext: string | false): Promise<string> => {
        if (!ext) {
            throw new Error('No extension found for the file')
        }

        // Si es archivo local, no necesita renombrar
        if (checkIsLocal) {
            return pathInput
        }

        const finalPath = `${pathInput}.${ext}`

        try {
            // 🔥 SOLUCIÓN: Usar safeRename con manejo de colisiones
            const resultPath = await safeRename(pathInput, finalPath)
            return resultPath
        } catch (error) {
            throw new Error(`Failed to rename file from ${pathInput} to ${finalPath}: ${error.message}`)
        }
    }

    try {
        const httpResponse = await handleDownload()
        const { ext } = await fileTypeFromFile(httpResponse.response)

        if (!ext) {
            throw new Error(`Unable to determine file extension for ${url}`)
        }

        const finalPath = await handleFile(httpResponse.fullPath, ext)
        return finalPath
    } catch (error) {
        console.error(`General download failed for ${url}:`, error)
        throw error
    }
}

export { generalDownload }
