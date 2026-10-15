/**
 * LAYER: Infrastructure
 * Contains: ChannelLister, GHLChannelInfo, GHLChannelType, GHLEmailAccount
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(n) score:3
 * keywords: [ChannelLister, GHLChannelInfo, GHLChannelType, GHLEmailAccount]
 * GOAL: Own the "channel lister" concern of the provider-gohighlevel package.
 */
import axios from 'axios'
import EventEmitter from 'node:events'

import type { GHLChannelInfo, GHLChannelType, GHLEmailAccount, GHLPhoneNumber } from '~/types'

const GHL_API_URL = 'https://services.leadconnectorhq.com'

/**
 * Lists available channels (phone numbers, emails) from GoHighLevel
 * @emits error - When API calls fail (non-permission errors only)
 */
export class ChannelLister extends EventEmitter {
    private apiVersion: string

    constructor(apiVersion: string = '2021-07-28') {
        super()
        this.apiVersion = apiVersion
    }

    /**
     * List active phone numbers for a location
     */
    async listPhoneNumbers(locationId: string, token: string): Promise<GHLPhoneNumber[]> {
        try {
            const response = await axios.get(`${GHL_API_URL}/phone-system/numbers/location/${locationId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Version: this.apiVersion,
                },
            })

            const data = response.data
            const numbers: GHLPhoneNumber[] = (data.numbers || data.data || []).map((n: any) => ({
                id: n.id || n._id,
                number: n.number || n.phoneNumber || n.phone,
                name: n.name || n.friendlyName || n.label,
                locationId: n.locationId,
                capabilities: n.capabilities || [],
                status: n.status,
            }))

            return numbers
        } catch (error: any) {
            // Don't throw - just return empty array
            // Scope 'phone-system.readonly' may be required
            const status = error.response?.status
            const errorMsg = error.response?.data?.message || error.message

            // Only emit error if it's not a permission issue (silently fail for missing scopes)
            if (status !== 401 && status !== 403) {
                this.emit('error', {
                    title: '📱 GHL Phone Numbers',
                    instructions: [errorMsg || 'Could not list phone numbers'],
                })
            }
            return []
        }
    }

    /**
     * List email accounts/addresses for a location
     * Note: GHL may not have a direct endpoint for this, trying conversation providers
     */
    async listEmails(locationId: string, token: string): Promise<GHLEmailAccount[]> {
        try {
            // Try to get location info which may include email settings
            const response = await axios.get(`${GHL_API_URL}/locations/${locationId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Version: this.apiVersion,
                },
            })

            const data = response.data?.location || response.data
            const emails: GHLEmailAccount[] = []

            // Extract email from location settings if available
            if (data.email) {
                emails.push({
                    id: 'location-email',
                    email: data.email,
                    name: data.name || 'Location Email',
                    locationId,
                })
            }

            // Check for business email
            if (data.business?.email && data.business.email !== data.email) {
                emails.push({
                    id: 'business-email',
                    email: data.business.email,
                    name: 'Business Email',
                    locationId,
                })
            }

            return emails
        } catch (error: any) {
            // Don't throw - just return empty array
            const status = error.response?.status
            const errorMsg = error.response?.data?.message || error.message

            // Only emit error if it's not a permission issue
            if (status !== 401 && status !== 403) {
                this.emit('error', {
                    title: '📧 GHL Email Accounts',
                    instructions: [errorMsg || 'Could not list email accounts'],
                })
            }
            return []
        }
    }

    /**
     * List channels based on channel type
     */
    async listByChannelType(channelType: GHLChannelType, locationId: string, token: string): Promise<GHLChannelInfo[]> {
        switch (channelType) {
            case 'SMS':
            case 'WhatsApp': {
                const phones = await this.listPhoneNumbers(locationId, token)
                return phones.map((p) => ({
                    type: 'phone' as const,
                    id: p.id,
                    value: p.number,
                    name: p.name,
                }))
            }
            case 'Email': {
                const emails = await this.listEmails(locationId, token)
                return emails.map((e) => ({
                    type: 'email' as const,
                    id: e.id,
                    value: e.email,
                    name: e.name,
                }))
            }
            default:
                // For other channel types (Facebook, Instagram, Live_Chat, Custom)
                // we don't have specific listing endpoints
                return []
        }
    }
}
