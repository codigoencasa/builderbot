import axios from 'axios'
import type { AxiosResponse } from 'axios'
import mimeTypes from 'mime-types'

const fileTypeFromResponse = (response: AxiosResponse): { type: string | null; ext: string | false } => {
    const type = response.headers['content-type'] ?? ''
    const ext = mimeTypes.extension(type)
    return { type, ext }
}

async function downloadFile(url: string, token: string): Promise<{ buffer: Buffer; extension: string }> {
    const response: AxiosResponse = await axios.get(url, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        maxBodyLength: Infinity,
        responseType: 'arraybuffer',
    })
    const { ext } = fileTypeFromResponse(response)
    if (!ext) throw new Error('Unable to determine file extension')
    return {
        buffer: response.data,
        extension: ext,
    }
}

export { downloadFile, fileTypeFromResponse }
