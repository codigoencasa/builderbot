/**
 * LAYER: Infrastructure
 * Contains: Download, IncomingMessage
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [Download, IncomingMessage]
 * GOAL: Own the "download" concern of the provider-evolution-api package.
 */
import followRedirects from 'follow-redirects'
import { rename, createWriteStream, existsSync } from 'fs'
import type { IncomingMessage } from 'http'
import mimeTypes from 'mime-types'
import { tmpdir } from 'os'
import { extname, basename, parse, join } from 'path'

const { http, https } = followRedirects

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
 * Descargar archivo binario en tmp
 * @param url - La URL del archivo a descargar
 * @returns La ruta al archivo descargado
 */
const generalDownload = async (url: string, pathToSave?: string, headers?: Record<string, any>): Promise<string> => {
    const checkIsLocal = existsSync(url)

    const handleDownload = (): Promise<{
        response: IncomingMessage
        fullPath: string
    }> => {
        try {
            const checkProtocol = url.startsWith('http')
            const handleHttp = checkProtocol ? https : http
            const fileName = basename(checkProtocol ? new URL(url).pathname : url)
            const name = parse(fileName).name
            const fullPath = join(pathToSave ?? tmpdir(), name)
            const file = createWriteStream(fullPath)

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
                 * From URL
                 */
                return new Promise((res, rej) => {
                    const options = {
                        headers: headers ?? {},
                    }
                    handleHttp.get(url, options, function (response) {
                        response.pipe(file)
                        file.on('finish', async function () {
                            file.close()
                            res({ response, fullPath })
                        })
                        file.on('error', function () {
                            file.close()
                            rej(new Error('Error downloading file'))
                        })
                    })
                })
            }
        } catch (err) {
            console.error('Error downloading file', err)
            return
        }
    }

    const handleFile = (pathInput: string, ext: string | false): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (!ext) {
                reject(new Error('No extension found for the file'))
                return
            }
            const fullPath = checkIsLocal ? `${pathInput}` : `${pathInput}.${ext}`
            rename(pathInput, fullPath, (err) => {
                if (err) reject(err)
                resolve(fullPath)
            })
        })
    }

    const httpResponse = await handleDownload()
    const { ext } = await fileTypeFromFile(httpResponse.response)
    if (!ext) throw new Error('Unable to determine file extension')
    const getPath = await handleFile(httpResponse.fullPath, ext)

    return getPath
}

export { generalDownload }
