import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Verifies the webhook signature using HMAC SHA256.
 * GoHighLevel sends the signature in the 'x-ghl-signature' header.
 *
 * @param payload - The raw request body as a string
 * @param signature - The signature from the request header
 * @param secret - The webhook secret (typically the client secret)
 * @returns true if the signature is valid, false otherwise
 */
export const verifyWebhookSignature = (payload: string, signature: string, secret: string): boolean => {
    if (!payload || !signature || !secret) {
        return false
    }

    try {
        const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex')

        // Use timing-safe comparison to prevent timing attacks
        const signatureBuffer = Buffer.from(signature, 'hex')
        const expectedBuffer = Buffer.from(expectedSignature, 'hex')

        if (signatureBuffer.length !== expectedBuffer.length) {
            return false
        }

        return timingSafeEqual(signatureBuffer, expectedBuffer)
    } catch {
        return false
    }
}

/**
 * Extracts the signature from the request headers.
 * Supports common header formats used by GoHighLevel.
 * Header names are case-insensitive per HTTP spec.
 *
 * @param headers - The request headers object
 * @returns The signature string or null if not found
 */
export const extractSignatureFromHeaders = (headers: Record<string, string | undefined>): string | null => {
    // Normalize headers to lowercase for case-insensitive lookup
    const normalizedHeaders: Record<string, string | undefined> = {}
    for (const key of Object.keys(headers)) {
        normalizedHeaders[key.toLowerCase()] = headers[key]
    }

    // GoHighLevel may use different header names
    const signatureHeaders = ['x-ghl-signature', 'x-signature', 'x-hub-signature-256', 'x-webhook-signature']

    for (const headerName of signatureHeaders) {
        const value = normalizedHeaders[headerName]
        if (value) {
            // Handle format "sha256=..." if present
            if (value.startsWith('sha256=')) {
                return value.slice(7)
            }
            return value
        }
    }

    return null
}
