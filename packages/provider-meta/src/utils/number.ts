const BSUID_REGEX = /^[A-Z]{2}\.[A-Za-z0-9]+$/

/**
 * Check whether a string is a WhatsApp Business-Scoped User ID (BSUID).
 * BSUIDs have the format `{ISO-3166 alpha-2}.{alphanumeric}` (e.g. `US.13491208655302741918`).
 * Meta requires the entire value, including the country code and period, to be sent unmodified.
 * @see https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids/
 */
export const isBSUID = (value: string): boolean => {
    return typeof value === 'string' && BSUID_REGEX.test(value)
}

export const parseMetaNumber = (number: string): string => {
    if (typeof number !== 'string') {
        return number
    }
    if (isBSUID(number)) {
        return number
    }
    return number.replace(/\+/g, '').replace(/\s/g, '')
}

/**
 * Map a phone or BSUID to the Graph API address field Meta expects.
 * Phones use `to`; BSUIDs must use `recipient` (not `to`).
 */
export function resolveOutboundAddress(id: string): { to: string } | { recipient: string } {
    const parsed = parseMetaNumber(id)
    if (isBSUID(parsed)) return { recipient: parsed }
    return { to: parsed }
}
