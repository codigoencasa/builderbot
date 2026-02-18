import axios from 'axios'
import EventEmitter from 'node:events'

import { parseGHLNumber } from './number'

import type { GHLContactSearchResult } from '~/types'

const GHL_API_URL = 'https://services.leadconnectorhq.com'

export class ContactResolver extends EventEmitter {
    private cache: Map<string, { contactId: string; expiresAt: number }> = new Map()
    private cacheTTL: number = 300000 // 5 minutes
    private apiVersion: string

    constructor(apiVersion: string = '2021-07-28', cacheTTL?: number) {
        super()
        this.apiVersion = apiVersion
        if (cacheTTL) this.cacheTTL = cacheTTL
    }

    async resolveContactId(phone: string, locationId: string, token: string): Promise<string | null> {
        const normalizedPhone = parseGHLNumber(phone)
        const cacheKey = `${locationId}:${normalizedPhone}`
        const cached = this.cache.get(cacheKey)
        if (cached && cached.expiresAt > Date.now()) {
            return cached.contactId
        }

        try {
            const response = await axios.get<GHLContactSearchResult>(`${GHL_API_URL}/contacts/`, {
                params: {
                    locationId,
                    query: normalizedPhone,
                },
                headers: {
                    Authorization: `Bearer ${token}`,
                    Version: this.apiVersion,
                },
            })

            const contacts = response.data?.contacts ?? []
            if (contacts.length === 0) return null

            const contact =
                contacts.find((c) => {
                    const contactPhone = parseGHLNumber(c.phone ?? '')
                    return contactPhone === normalizedPhone
                }) ?? contacts[0]

            this.cache.set(cacheKey, {
                contactId: contact.id,
                expiresAt: Date.now() + this.cacheTTL,
            })

            return contact.id
        } catch (error) {
            this.emit('error', {
                title: 'GHL CONTACT RESOLVER ERROR',
                instructions: [`Error resolving contactId for ${phone}: ${error.message}`],
            })
            return null
        }
    }

    clearCache(): void {
        this.cache.clear()
    }
}
