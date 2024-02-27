import axios from 'axios'
import type { AxiosResponse } from 'axios'

import { WhatsAppProfile } from '../types'

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
    } catch (error) {
        console.error(error.message)
    }
}

export { getProfile }
