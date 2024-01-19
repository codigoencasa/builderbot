import axios, { AxiosResponse } from 'axios'
import { MediaResponse } from './types'

async function getMediaUrl(
    version: string,
    IdMedia: string,
    numberId: string,
    Token: string
): Promise<string | undefined> {
    try {
        const response: AxiosResponse<MediaResponse> = await axios.get(
            `https://graph.facebook.com/${version}/${IdMedia}?phone_number_id=${numberId}`,
            {
                headers: {
                    Authorization: `Bearer ${Token}`,
                },
                maxBodyLength: Infinity,
            }
        )

        return response.data?.url
    } catch (error) {
        console.error(error.message)
    }
}

export { getMediaUrl }
