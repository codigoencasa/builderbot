/**
 * LAYER: Infrastructure
 * Contains: getProfile — WhatsApp profile fetch via Meta Graph API
 * Rules: External HTTP client. No business rules.
 * BigO: O(1) score:5
 * keywords: [getProfile, WhatsAppProfile, MetaProvider]
 * GOAL: Fetch a WhatsApp user profile from the Graph API.
 */
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
    const response: AxiosResponse<WhatsAppProfile> = await axios.get(
        `https://graph.facebook.com/${version}/${numberId}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    )
    return response.data
}

export { getProfile }
