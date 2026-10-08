/**
 * LAYER: Infrastructure
 * Contains: getMediaUrl — Meta Graph API media URL resolver
 * Rules: External HTTP client. Returns a Domain media descriptor.
 * BigO: O(1) score:5
 * keywords: [getMediaUrl, MediaResponse, processIncomingMessage]
 * GOAL: Resolve the download URL for a Meta media id via the Graph API.
 */
import axios from 'axios'
import type { AxiosResponse } from 'axios'

import type { MediaResponse } from '~/types'

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
