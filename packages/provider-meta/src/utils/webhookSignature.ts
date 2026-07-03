import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Verifies the `X-Hub-Signature-256` header Meta sends on every webhook
 * `POST` request (`sha256=<hmac-hex>` over the raw JSON body), using the
 * app's `appSecret`.
 *
 * @param rawBody - The raw (unparsed) request body as received on the wire.
 * @param signatureHeader - The value of the `X-Hub-Signature-256` header.
 * @param appSecret - The Meta App Secret configured for the app.
 * @returns `true` when the signature matches, `false` otherwise (including malformed input).
 */
export const verifyMetaSignature = (rawBody: string, signatureHeader: string, appSecret: string): boolean => {
    if (!rawBody || !signatureHeader || !appSecret) return false

    const [algo, signature] = signatureHeader.split('=')
    if (algo !== 'sha256' || !signature) return false

    try {
        const expectedSignature = createHmac('sha256', appSecret).update(rawBody).digest('hex')

        const signatureBuffer = Buffer.from(signature, 'hex')
        const expectedBuffer = Buffer.from(expectedSignature, 'hex')

        if (signatureBuffer.length !== expectedBuffer.length) return false

        return timingSafeEqual(signatureBuffer, expectedBuffer)
    } catch {
        return false
    }
}

/**
 * Extracts the `X-Hub-Signature-256` header value from a request, handling
 * case-insensitive header lookup.
 *
 * @param headers - The request headers object.
 * @returns The signature header value, or `null` when absent.
 */
export const extractMetaSignature = (headers: Record<string, string | undefined>): string | null => {
    if (!headers) return null
    const normalized: Record<string, string | undefined> = {}
    for (const key of Object.keys(headers)) normalized[key.toLowerCase()] = headers[key]
    return normalized['x-hub-signature-256'] ?? null
}
