import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import axios from 'axios'

import { GHLIncomingWebhook } from '../src/types'
import { ContactResolver } from '../src/utils/contactResolver'
import { downloadFile, fileTypeFromResponse } from '../src/utils/downloadFile'
import { parseGHLNumber } from '../src/utils/number'
import { processIncomingMessage } from '../src/utils/processIncomingMsg'
import { TokenManager } from '../src/utils/tokenManager'
import { verifyWebhookSignature, extractSignatureFromHeaders } from '../src/utils/webhookVerification'

jest.mock('axios')
jest.mock('@builderbot/bot', () => ({
    utils: {
        generateRefProvider: jest.fn((type: string) => `__ref_provider_${type}__`),
    },
}))

describe('#parseGHLNumber', () => {
    test('should remove + symbol from number', () => {
        expect(parseGHLNumber('+1234567890')).toBe('1234567890')
    })

    test('should remove spaces from number', () => {
        expect(parseGHLNumber('1 234 567 890')).toBe('1234567890')
    })

    test('should remove dashes from number', () => {
        expect(parseGHLNumber('1-234-567-890')).toBe('1234567890')
    })

    test('should handle combined formatting with parentheses', () => {
        expect(parseGHLNumber('+1 (234) 567-890')).toBe('1234567890')
    })

    test('should remove all non-numeric characters', () => {
        expect(parseGHLNumber('+1.234.567.890')).toBe('1234567890')
        expect(parseGHLNumber('(123) 456-7890')).toBe('1234567890')
    })

    test('should return non-string values as-is', () => {
        expect(parseGHLNumber(12345 as any)).toBe(12345)
    })
})

describe('#processIncomingMessage', () => {
    test('should return null for null input', () => {
        expect(processIncomingMessage(null as any)).toBeNull()
    })

    test('should return null for outbound messages', () => {
        const webhook: GHLIncomingWebhook = {
            type: 'OutboundMessage',
            locationId: 'loc_123',
            direction: 'outbound',
        }
        expect(processIncomingMessage(webhook)).toBeNull()
    })

    test('should process inbound text message', () => {
        const webhook: GHLIncomingWebhook = {
            type: 'InboundMessage',
            locationId: 'loc_123',
            direction: 'inbound',
            body: 'Hello World',
            phone: '+1234567890',
            contactId: 'contact_123',
            conversationId: 'conv_123',
            messageId: 'msg_123',
            dateAdded: '2025-01-01T00:00:00.000Z',
        }

        const result = processIncomingMessage(webhook)

        expect(result).not.toBeNull()
        expect(result!.type).toBe('text')
        expect(result!.body).toBe('Hello World')
        expect(result!.from).toBe('1234567890')
        expect(result!.to).toBe('loc_123')
        expect(result!.contactId).toBe('contact_123')
        expect(result!.conversationId).toBe('conv_123')
        expect(result!.message_id).toBe('msg_123')
    })

    test('should process inbound message with image attachment', () => {
        const webhook: GHLIncomingWebhook = {
            type: 'InboundMessage',
            locationId: 'loc_123',
            direction: 'inbound',
            body: '',
            phone: '+1234567890',
            contactId: 'contact_123',
            messageId: 'msg_456',
            attachments: [{ url: 'https://example.com/image.jpg', type: 'image/jpeg' }],
        }

        const result = processIncomingMessage(webhook)

        expect(result).not.toBeNull()
        expect(result!.type).toBe('image')
        expect(result!.url).toBe('https://example.com/image.jpg')
        expect(result!.attachments).toHaveLength(1)
    })

    test('should process inbound message with video attachment', () => {
        const webhook: GHLIncomingWebhook = {
            type: 'InboundMessage',
            locationId: 'loc_123',
            direction: 'inbound',
            body: '',
            phone: '+1234567890',
            contactId: 'contact_123',
            messageId: 'msg_789',
            attachments: [{ url: 'https://example.com/video.mp4', type: 'video/mp4' }],
        }

        const result = processIncomingMessage(webhook)

        expect(result).not.toBeNull()
        expect(result!.type).toBe('video')
        expect(result!.url).toBe('https://example.com/video.mp4')
    })

    test('should process inbound message with audio attachment', () => {
        const webhook: GHLIncomingWebhook = {
            type: 'InboundMessage',
            locationId: 'loc_123',
            direction: 'inbound',
            body: '',
            phone: '+1234567890',
            contactId: 'contact_123',
            messageId: 'msg_audio',
            attachments: [{ url: 'https://example.com/audio.mp3', type: 'audio/mp3' }],
        }

        const result = processIncomingMessage(webhook)

        expect(result).not.toBeNull()
        expect(result!.type).toBe('audio')
    })

    test('should process inbound message with document attachment', () => {
        const webhook: GHLIncomingWebhook = {
            type: 'InboundMessage',
            locationId: 'loc_123',
            direction: 'inbound',
            body: '',
            phone: '+1234567890',
            contactId: 'contact_123',
            messageId: 'msg_doc',
            attachments: [{ url: 'https://example.com/file.pdf', type: 'application/pdf' }],
        }

        const result = processIncomingMessage(webhook)

        expect(result).not.toBeNull()
        expect(result!.type).toBe('document')
    })

    test('should use contactId as name fallback', () => {
        const webhook: GHLIncomingWebhook = {
            type: 'InboundMessage',
            locationId: 'loc_123',
            direction: 'inbound',
            body: 'Hi',
            phone: '+1234567890',
            contactId: 'contact_ABC',
            messageId: 'msg_name',
        }

        const result = processIncomingMessage(webhook)

        expect(result!.name).toBe('contact_ABC')
        expect(result!.pushName).toBe('contact_ABC')
    })
})

describe('#TokenManager', () => {
    let tokenManager: TokenManager

    beforeEach(() => {
        tokenManager = new TokenManager('client_id', 'client_secret', 'http://localhost/callback')
    })

    afterEach(() => {
        tokenManager.destroy()
    })

    test('should initialize with empty tokens', () => {
        expect(tokenManager.getAccessToken()).toBe('')
        expect(tokenManager.getRefreshToken()).toBe('')
    })

    test('should set tokens correctly', () => {
        tokenManager.setTokens({
            access_token: 'test_token',
            refresh_token: 'test_refresh',
            expires_in: 86400,
        })

        expect(tokenManager.getAccessToken()).toBe('test_token')
        expect(tokenManager.getRefreshToken()).toBe('test_refresh')
    })

    test('should report token as not expired after setting', () => {
        tokenManager.setTokens({
            access_token: 'test_token',
            expires_in: 86400,
        })

        expect(tokenManager.isTokenExpired()).toBe(false)
    })

    test('should report token as expired when no token set', () => {
        expect(tokenManager.isTokenExpired()).toBe(true)
    })

    test('should return access token from getValidToken when not expired', async () => {
        tokenManager.setTokens({
            access_token: 'valid_token',
            expires_in: 86400,
        })

        const token = await tokenManager.getValidToken()
        expect(token).toBe('valid_token')
    })

    test('should throw error on refreshAccessToken when no refresh token', async () => {
        await expect(tokenManager.refreshAccessToken()).rejects.toThrow('No refresh token available')
    })

    test('destroy should clear refresh timer', () => {
        tokenManager.setTokens({
            access_token: 'test',
            expires_in: 86400,
        })

        tokenManager.destroy()
        // Should not throw
        tokenManager.destroy()
    })
})

describe('#fileTypeFromResponse', () => {
    test('should extract type and extension from content-type header', () => {
        const mockResponse = {
            headers: { 'content-type': 'image/jpeg' },
            data: Buffer.from('test'),
        }

        const result = fileTypeFromResponse(mockResponse as any)

        expect(result.type).toBe('image/jpeg')
        // mime-types returns 'jpg' for image/jpeg
        expect(result.ext).toBe('jpg')
    })

    test('should handle content-type with charset', () => {
        const mockResponse = {
            headers: { 'content-type': 'text/plain; charset=utf-8' },
            data: Buffer.from('test'),
        }

        const result = fileTypeFromResponse(mockResponse as any)

        expect(result.type).toBe('text/plain; charset=utf-8')
        expect(result.ext).toBe('txt')
    })

    test('should return false for unknown content-type', () => {
        const mockResponse = {
            headers: { 'content-type': 'application/x-unknown' },
            data: Buffer.from('test'),
        }

        const result = fileTypeFromResponse(mockResponse as any)

        expect(result.ext).toBe(false)
    })

    test('should handle missing content-type header', () => {
        const mockResponse = {
            headers: {},
            data: Buffer.from('test'),
        }

        const result = fileTypeFromResponse(mockResponse as any)

        expect(result.type).toBe('')
        expect(result.ext).toBe(false)
    })
})

describe('#downloadFile', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('should download file and return buffer with extension', async () => {
        const mockBuffer = Buffer.from('file content')
        ;(axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValue({
            headers: { 'content-type': 'image/png' },
            data: mockBuffer,
        })

        const result = await downloadFile('https://example.com/image.png', 'test_token')

        expect(axios.get).toHaveBeenCalledWith('https://example.com/image.png', {
            headers: { Authorization: 'Bearer test_token' },
            maxBodyLength: Infinity,
            responseType: 'arraybuffer',
        })
        expect(result.buffer).toBe(mockBuffer)
        expect(result.extension).toBe('png')
    })

    test('should throw error when extension cannot be determined', async () => {
        ;(axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValue({
            headers: { 'content-type': 'application/x-unknown' },
            data: Buffer.from('data'),
        })

        await expect(downloadFile('https://example.com/file', 'token')).rejects.toThrow(
            'Unable to determine file extension'
        )
    })

    test('should throw error when axios fails', async () => {
        ;(axios.get as jest.MockedFunction<typeof axios.get>).mockRejectedValue(new Error('Network error'))

        await expect(downloadFile('https://example.com/file.jpg', 'token')).rejects.toThrow('Network error')
    })

    test('should handle PDF content-type', async () => {
        const mockBuffer = Buffer.from('pdf content')
        ;(axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValue({
            headers: { 'content-type': 'application/pdf' },
            data: mockBuffer,
        })

        const result = await downloadFile('https://example.com/doc.pdf', 'token')

        expect(result.extension).toBe('pdf')
    })

    test('should handle audio content-type', async () => {
        const mockBuffer = Buffer.from('audio content')
        // Use audio/mp3 which returns 'mp3' extension
        ;(axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValue({
            headers: { 'content-type': 'audio/mp3' },
            data: mockBuffer,
        })

        const result = await downloadFile('https://example.com/audio.mp3', 'token')

        expect(result.extension).toBe('mp3')
    })
})

describe('#ContactResolver', () => {
    let contactResolver: ContactResolver

    beforeEach(() => {
        jest.clearAllMocks()
        contactResolver = new ContactResolver('2021-07-28', 1000) // 1 second TTL for tests
    })

    test('should initialize with default apiVersion', () => {
        const resolver = new ContactResolver()
        expect(resolver).toBeDefined()
    })

    test('should initialize with custom cacheTTL', () => {
        const resolver = new ContactResolver('2021-07-28', 60000)
        expect(resolver).toBeDefined()
    })

    test('should resolve contactId from API', async () => {
        ;(axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValue({
            data: {
                contacts: [{ id: 'contact_123', phone: '+1234567890' }],
            },
        })

        const result = await contactResolver.resolveContactId('+1234567890', 'location_abc', 'test_token')

        expect(result).toBe('contact_123')
        expect(axios.get).toHaveBeenCalledWith('https://services.leadconnectorhq.com/contacts/', {
            params: {
                locationId: 'location_abc',
                query: '1234567890',
            },
            headers: {
                Authorization: 'Bearer test_token',
                Version: '2021-07-28',
            },
        })
    })

    test('should return cached contactId on subsequent calls', async () => {
        ;(axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValue({
            data: {
                contacts: [{ id: 'contact_cached', phone: '1234567890' }],
            },
        })

        // First call - should hit API
        const result1 = await contactResolver.resolveContactId('1234567890', 'location_abc', 'token')
        expect(result1).toBe('contact_cached')
        expect(axios.get).toHaveBeenCalledTimes(1)

        // Second call - should use cache
        const result2 = await contactResolver.resolveContactId('1234567890', 'location_abc', 'token')
        expect(result2).toBe('contact_cached')
        expect(axios.get).toHaveBeenCalledTimes(1) // Still 1, cache was used
    })

    test('should return null when no contacts found', async () => {
        ;(axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValue({
            data: { contacts: [] },
        })

        const result = await contactResolver.resolveContactId('0000000000', 'location_abc', 'token')

        expect(result).toBeNull()
    })

    test('should return null when API call fails', async () => {
        ;(axios.get as jest.MockedFunction<typeof axios.get>).mockRejectedValue(new Error('API Error'))

        // Add error listener to prevent unhandled error
        const errorHandler = jest.fn()
        contactResolver.on('error', errorHandler)

        const result = await contactResolver.resolveContactId('1234567890', 'location_abc', 'token')

        expect(result).toBeNull()
        expect(errorHandler).toHaveBeenCalledWith({
            title: 'GHL CONTACT RESOLVER ERROR',
            instructions: ['Error resolving contactId for 1234567890: API Error'],
        })
    })

    test('should find exact phone match in contacts list', async () => {
        ;(axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValue({
            data: {
                contacts: [
                    { id: 'contact_wrong', phone: '+9999999999' },
                    { id: 'contact_correct', phone: '+1234567890' },
                    { id: 'contact_another', phone: '+8888888888' },
                ],
            },
        })

        const result = await contactResolver.resolveContactId('1234567890', 'location_abc', 'token')

        expect(result).toBe('contact_correct')
    })

    test('should fallback to first contact when no exact match', async () => {
        ;(axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValue({
            data: {
                contacts: [
                    { id: 'contact_first', phone: '+9999999999' },
                    { id: 'contact_second', phone: '+8888888888' },
                ],
            },
        })

        const result = await contactResolver.resolveContactId('1234567890', 'location_abc', 'token')

        expect(result).toBe('contact_first')
    })

    test('should clearCache properly', async () => {
        ;(axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValue({
            data: {
                contacts: [{ id: 'contact_1', phone: '1234567890' }],
            },
        })

        // Populate cache
        await contactResolver.resolveContactId('1234567890', 'loc', 'token')
        expect(axios.get).toHaveBeenCalledTimes(1)

        // Clear cache
        contactResolver.clearCache()

        // Should hit API again
        await contactResolver.resolveContactId('1234567890', 'loc', 'token')
        expect(axios.get).toHaveBeenCalledTimes(2)
    })

    test('should handle contact with null phone', async () => {
        ;(axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValue({
            data: {
                contacts: [
                    { id: 'contact_no_phone', phone: null },
                    { id: 'contact_with_phone', phone: '+1234567890' },
                ],
            },
        })

        const result = await contactResolver.resolveContactId('1234567890', 'location_abc', 'token')

        expect(result).toBe('contact_with_phone')
    })

    test('should use different cache keys for different locations', async () => {
        ;(axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValue({
            data: {
                contacts: [{ id: 'contact_loc1', phone: '1234567890' }],
            },
        })

        await contactResolver.resolveContactId('1234567890', 'location_1', 'token')
        ;(axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValue({
            data: {
                contacts: [{ id: 'contact_loc2', phone: '1234567890' }],
            },
        })

        await contactResolver.resolveContactId('1234567890', 'location_2', 'token')

        // Both calls should hit API (different cache keys)
        expect(axios.get).toHaveBeenCalledTimes(2)
    })
})

describe('#verifyWebhookSignature', () => {
    const secret = 'test_secret_key'
    const payload = '{"type":"InboundMessage","body":"Hello"}'

    // Pre-computed HMAC SHA256 signature for the payload with the secret
    // crypto.createHmac('sha256', 'test_secret_key').update(payload).digest('hex')
    const validSignature = 'f8c0c4e1e8e5c3a5f8c0c4e1e8e5c3a5f8c0c4e1e8e5c3a5f8c0c4e1e8e5c3a5'

    test('should return false for empty payload', () => {
        expect(verifyWebhookSignature('', validSignature, secret)).toBe(false)
    })

    test('should return false for empty signature', () => {
        expect(verifyWebhookSignature(payload, '', secret)).toBe(false)
    })

    test('should return false for empty secret', () => {
        expect(verifyWebhookSignature(payload, validSignature, '')).toBe(false)
    })

    test('should return false for invalid signature', () => {
        const invalidSignature = 'invalid_signature_that_is_definitely_wrong'
        expect(verifyWebhookSignature(payload, invalidSignature, secret)).toBe(false)
    })

    test('should return false for signature with wrong length', () => {
        const shortSignature = 'abcd1234'
        expect(verifyWebhookSignature(payload, shortSignature, secret)).toBe(false)
    })

    test('should verify correct signature', () => {
        // Generate the actual valid signature
        const crypto = require('node:crypto')
        const actualSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex')

        expect(verifyWebhookSignature(payload, actualSignature, secret)).toBe(true)
    })

    test('should reject tampered payload', () => {
        const crypto = require('node:crypto')
        const originalSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex')
        const tamperedPayload = '{"type":"InboundMessage","body":"Tampered"}'

        expect(verifyWebhookSignature(tamperedPayload, originalSignature, secret)).toBe(false)
    })
})

describe('#extractSignatureFromHeaders', () => {
    test('should extract signature from x-ghl-signature header', () => {
        const headers = { 'x-ghl-signature': 'abc123' }
        expect(extractSignatureFromHeaders(headers)).toBe('abc123')
    })

    test('should extract signature from x-signature header', () => {
        const headers = { 'x-signature': 'def456' }
        expect(extractSignatureFromHeaders(headers)).toBe('def456')
    })

    test('should extract signature from x-hub-signature-256 header', () => {
        const headers = { 'x-hub-signature-256': 'ghi789' }
        expect(extractSignatureFromHeaders(headers)).toBe('ghi789')
    })

    test('should extract signature from x-webhook-signature header', () => {
        const headers = { 'x-webhook-signature': 'jkl012' }
        expect(extractSignatureFromHeaders(headers)).toBe('jkl012')
    })

    test('should handle sha256= prefix', () => {
        const headers = { 'x-ghl-signature': 'sha256=abc123' }
        expect(extractSignatureFromHeaders(headers)).toBe('abc123')
    })

    test('should return null when no signature header found', () => {
        const headers = { 'content-type': 'application/json' }
        expect(extractSignatureFromHeaders(headers)).toBeNull()
    })

    test('should handle lowercase header names', () => {
        const headers = { 'X-GHL-SIGNATURE': 'uppercase123' }
        expect(extractSignatureFromHeaders(headers)).toBe('uppercase123')
    })

    test('should prioritize x-ghl-signature over others', () => {
        const headers = {
            'x-ghl-signature': 'ghl_sig',
            'x-signature': 'other_sig',
        }
        expect(extractSignatureFromHeaders(headers)).toBe('ghl_sig')
    })
})
