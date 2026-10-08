import { describe, expect, test } from '@jest/globals'
import { createHmac } from 'node:crypto'

import { extractMetaSignature, verifyMetaSignature } from '../src/utils/webhookSignature'

describe('#verifyMetaSignature', () => {
    const secret = 'my-app-secret'
    const payload = JSON.stringify({ entry: [{ changes: [{ field: 'messages' }] }] })

    test('returns true for a valid sha256 signature', () => {
        // Arrange
        const signature = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`

        // Act
        const result = verifyMetaSignature(payload, signature, secret)

        // Assert
        expect(result).toBe(true)
    })

    test('returns false when the signature does not match the payload', () => {
        // Arrange
        const signature = `sha256=${createHmac('sha256', secret).update('tampered').digest('hex')}`

        // Act
        const result = verifyMetaSignature(payload, signature, secret)

        // Assert
        expect(result).toBe(false)
    })

    test('returns false when the secret is wrong', () => {
        // Arrange
        const signature = `sha256=${createHmac('sha256', 'wrong-secret').update(payload).digest('hex')}`

        // Act
        const result = verifyMetaSignature(payload, signature, secret)

        // Assert
        expect(result).toBe(false)
    })

    test('returns false when the algorithm prefix is missing or unsupported', () => {
        // Arrange
        const rawHex = createHmac('sha256', secret).update(payload).digest('hex')

        // Act & Assert
        expect(verifyMetaSignature(payload, rawHex, secret)).toBe(false)
        expect(verifyMetaSignature(payload, `sha1=${rawHex}`, secret)).toBe(false)
    })

    test('returns false for empty/missing arguments', () => {
        expect(verifyMetaSignature('', 'sha256=abc', secret)).toBe(false)
        expect(verifyMetaSignature(payload, '', secret)).toBe(false)
        expect(verifyMetaSignature(payload, 'sha256=abc', '')).toBe(false)
    })

    test('returns false instead of throwing for a malformed hex signature', () => {
        // Act & Assert
        expect(() => verifyMetaSignature(payload, 'sha256=not-hex-!!', secret)).not.toThrow()
        expect(verifyMetaSignature(payload, 'sha256=not-hex-!!', secret)).toBe(false)
    })
})

describe('#extractMetaSignature', () => {
    test('extracts the header value using a case-insensitive lookup', () => {
        expect(extractMetaSignature({ 'X-Hub-Signature-256': 'sha256=abc' })).toBe('sha256=abc')
        expect(extractMetaSignature({ 'x-hub-signature-256': 'sha256=abc' })).toBe('sha256=abc')
    })

    test('returns null when the header is absent', () => {
        expect(extractMetaSignature({})).toBeNull()
    })

    test('returns null when headers is null/undefined', () => {
        expect(extractMetaSignature(null as never)).toBeNull()
        expect(extractMetaSignature(undefined as never)).toBeNull()
    })
})
