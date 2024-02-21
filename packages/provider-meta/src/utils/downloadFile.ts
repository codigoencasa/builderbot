import axios from 'axios'
import type { AxiosResponse } from 'axios'
import mimeTypes from 'mime-types'

/**
 * Extraer el mimetype from buffer
 * @param response - La respuesta HTTP
 * @returns Un objeto con el tipo y la extensión del archivo
 */
const fileTypeFromFile = async (response: AxiosResponse): Promise<{ type: string | null; ext: string | false }> => {
    const type = response.headers['content-type'] ?? ''
    const ext = mimeTypes.extension(type)
    return {
        type,
        ext,
    }
}

async function downloadFile(url: string, Token: string): Promise<{ buffer: Buffer; extension: string }> {
    try {
        const response: AxiosResponse = await axios.get(`${url}`, {
            headers: {
                Authorization: `Bearer ${Token}`,
            },
            maxBodyLength: Infinity,
            responseType: 'arraybuffer',
        })
        const { ext } = await fileTypeFromFile(response)
        if (!ext) throw new Error('Unable to determine file extension')
        return {
            buffer: response.data,
            extension: ext,
        }
    } catch (error) {
        console.error(error.message)
    }
}

export { downloadFile, fileTypeFromFile }
