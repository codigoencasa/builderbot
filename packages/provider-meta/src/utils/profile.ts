import axios from 'axios'
import type { AxiosResponse } from 'axios'

import type { WhatsAppProfile } from '~/types'

/**
 * Get the profile of a WhatsApp user
 * @param version - The version of the WhatsApp API
 * @param numberId - The ID of the WhatsApp user
 * @param token - The token of the WhatsApp user
 * @returns The profile of the WhatsApp user
 */
async function getProfile(version: string, numberId: string, token: string): Promise<WhatsAppProfile> {
    try {
        const response: AxiosResponse<WhatsAppProfile> = await axios.get(
            `https://graph.facebook.com/${version}/${numberId}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        )
        return response.data
    } catch (err) {
        const apiError = err?.response?.data?.error
        if (apiError) {
            const enrichedError = new Error(apiError.message || 'Unknown Meta API error')
            enrichedError['response'] = err.response
            enrichedError['code'] = apiError.code
            enrichedError['errorSubcode'] = apiError.error_subcode
            enrichedError['fbtrace_id'] = apiError.fbtrace_id
            throw enrichedError
        }
        throw err
    }
}

export { getProfile }
