import { describe, expect, jest, test } from '@jest/globals'
import { processIncomingMessage } from '../src/utils'

jest.mock('../src/utils/mediaUrl', () => ({
    getMediaUrl: jest.fn(),
}))

describe('#processIncomingMessage ', () => {
    test('should process text message correctly', async () => {
        const params = {
            messageId: '123',
            messageTimestamp: Date.now(),
            pushName: 'John Doe',
            message: { type: 'text', from: 'sender', text: { body: 'Hello' } },
            to: 'receiver',
            jwtToken: 'fakeToken',
            version: '1.0',
            numberId: '987',
        }

        const expectedResponse = {
            type: 'text',
            from: 'sender',
            to: 'receiver',
            body: 'Hello',
            name: 'John Doe',
            pushName: 'John Doe',
            message_id: '123',
            timestamp: expect.any(Number),
        }

        const result = await processIncomingMessage(params)

        expect(result).toEqual(expectedResponse)
    })

    test('should process interactive message correctly', async () => {
        // Arrange
        const params = {
            messageId: '123',
            messageTimestamp: Date.now(),
            pushName: 'John Doe',
            message: {
                type: 'interactive',
                from: 'sender',
                interactive: {
                    button_reply: { title: 'Button Reply' },
                    list_reply: { id: 'List Reply' },
                },
            },
            to: 'receiver',
            jwtToken: 'fakeToken',
            version: '1.0',
            numberId: '987',
        }

        // Act
        const result = await processIncomingMessage(params)

        // Assert
        expect(result).toEqual({
            type: 'interactive',
            from: 'sender',
            to: 'receiver',
            body: 'Button Reply',
            title_button_reply: 'Button Reply',
            pushName: 'John Doe',
            name: 'John Doe',
            message_id: '123',
            timestamp: expect.any(Number),
        })
    })

    test('should process interactive message with list_reply correctly', async () => {
        // Arrange
        const params = {
            messageId: '123',
            messageTimestamp: Date.now(),
            pushName: 'John Doe',
            message: {
                type: 'interactive',
                from: 'sender',
                interactive: {
                    list_reply: { id: 'List Reply' },
                },
            },
            to: 'receiver',
            jwtToken: 'fakeToken',
            version: '1.0',
            numberId: '987',
        }

        // Act
        const result = await processIncomingMessage(params)

        // Assert
        expect(result).toEqual({
            type: 'interactive',
            from: 'sender',
            to: 'receiver',
            body: 'List Reply',
            title_button_reply: undefined,
            title_list_reply: undefined,
            pushName: 'John Doe',
            name: 'John Doe',
            message_id: '123',
            timestamp: expect.any(Number),
        })
    })

    test('should process button message correctly', async () => {
        // Arrange
        const params = {
            messageId: '123',
            messageTimestamp: Date.now(),
            pushName: 'John Doe',
            message: {
                type: 'button',
                from: 'sender',
                button: { text: 'Click me', payload: 'ButtonPayload' },
            },
            to: 'receiver',
            jwtToken: 'fakeToken',
            version: '1.0',
            numberId: '987',
        }

        // Act
        const result = await processIncomingMessage(params)

        // Assert
        expect(result).toEqual({
            type: 'button',
            from: 'sender',
            to: 'receiver',
            body: 'Click me',
            payload: 'ButtonPayload',
            title_button_reply: 'ButtonPayload',
            pushName: 'John Doe',
            name: 'John Doe',
            message_id: '123',
            timestamp: expect.any(Number),
        })
    })

    test('should process image message correctly', async () => {
        // Arrange
        const imageUrl = 'https://example.com/image.jpg'
        const params = {
            messageId: '123',
            messageTimestamp: Date.now(),
            pushName: 'John Doe',
            message: {
                type: 'image',
                from: 'sender',
                image: { id: 'imageId' },
            },
            to: 'receiver',
            jwtToken: 'fakeToken',
            version: '1.0',
            numberId: '987',
        }

        ;(require('../src/utils/mediaUrl').getMediaUrl as jest.Mock).mockImplementation(() => imageUrl)

        // Act
        const result = await processIncomingMessage(params)

        // Assert
        expect(result).toEqual({
            type: 'image',
            from: 'sender',
            to: 'receiver',
            url: imageUrl,
            body: expect.any(String),
            pushName: 'John Doe',
            name: 'John Doe',
            message_id: '123',
            timestamp: expect.any(Number),
        })
    })

    test('should process document message correctly', async () => {
        // Arrange
        const documentUrl = 'https://example.com/image.jpg'
        const params = {
            messageId: '123',
            messageTimestamp: Date.now(),
            pushName: 'John Doe',
            message: {
                type: 'document',
                from: 'sender',
                document: { id: 'documentId' },
            },
            to: 'receiver',
            jwtToken: 'fakeToken',
            version: '1.0',
            numberId: '987',
        }

        ;(require('../src/utils/mediaUrl').getMediaUrl as jest.Mock).mockImplementation(() => documentUrl)
        // Act
        const result = await processIncomingMessage(params)

        // Assert
        expect(result).toEqual({
            type: 'document',
            from: 'sender',
            to: 'receiver',
            url: documentUrl,
            body: expect.any(String),
            pushName: 'John Doe',
            name: 'John Doe',
            message_id: '123',
            timestamp: expect.any(Number),
        })
    })

    test('should process video message correctly', async () => {
        // Arrange
        const videoUrl = 'https://example.com/video.mp4'
        const params = {
            messageId: '123',
            messageTimestamp: Date.now(),
            pushName: 'John Doe',
            message: {
                type: 'video',
                from: 'sender',
                video: { id: 'videoId' },
            },
            to: 'receiver',
            jwtToken: 'fakeToken',
            version: '1.0',
            numberId: '987',
        }

        ;(require('../src/utils/mediaUrl').getMediaUrl as jest.Mock).mockImplementation(() => videoUrl)
        // Act
        const result = await processIncomingMessage(params)

        // Assert
        expect(result).toEqual({
            type: 'video',
            from: 'sender',
            to: 'receiver',
            url: videoUrl,
            body: expect.any(String),
            pushName: 'John Doe',
            name: 'John Doe',
            message_id: '123',
            timestamp: expect.any(Number),
        })
    })

    test('should process location message correctly', async () => {
        // Arrange
        const params = {
            messageId: '123',
            messageTimestamp: Date.now(),
            pushName: 'John Doe',
            message: {
                type: 'location',
                from: 'sender',
                location: { latitude: 40.7128, longitude: -74.006 },
            },
            to: 'receiver',
            jwtToken: 'fakeToken',
            version: '1.0',
            numberId: '987',
        }

        // Act
        const result = await processIncomingMessage(params)

        // Assert
        expect(result).toEqual({
            type: 'location',
            from: 'sender',
            to: 'receiver',
            latitude: 40.7128,
            longitude: -74.006,
            body: expect.any(String),
            pushName: 'John Doe',
            name: 'John Doe',
            message_id: '123',
            timestamp: expect.any(Number),
        })
    })

    test('should process audio message correctly', async () => {
        // Arrange
        const audioUrl = 'https://example.com/audio.mp3'
        const params = {
            messageId: '123',
            messageTimestamp: Date.now(),
            pushName: 'John Doe',
            message: {
                type: 'audio',
                from: 'sender',
                audio: { id: 'audioId' },
            },
            to: 'receiver',
            jwtToken: 'fakeToken',
            version: '1.0',
            numberId: '987',
        }
        ;(require('../src/utils/mediaUrl').getMediaUrl as jest.Mock).mockImplementation(() => audioUrl)
        // Act
        const result = await processIncomingMessage(params)

        // Assert
        expect(result).toEqual({
            type: 'audio',
            from: 'sender',
            to: 'receiver',
            url: audioUrl,
            body: expect.any(String),
            pushName: 'John Doe',
            name: 'John Doe',
            message_id: '123',
            timestamp: expect.any(Number),
        })
    })

    test('should process sticker message correctly', async () => {
        // Arrange
        const params = {
            messageId: '123',
            messageTimestamp: Date.now(),
            pushName: 'John Doe',
            message: {
                type: 'sticker',
                from: 'sender',
                sticker: { id: 'stickerId' },
            },
            to: 'receiver',
            jwtToken: 'fakeToken',
            version: '1.0',
            numberId: '987',
        }

        // Act
        const result = await processIncomingMessage(params)

        // Assert
        expect(result).toEqual({
            type: 'sticker',
            from: 'sender',
            to: 'receiver',
            id: 'stickerId',
            body: expect.any(String),
            pushName: 'John Doe',
            name: 'John Doe',
            message_id: '123',
            timestamp: expect.any(Number),
        })
    })

    test('should process contacts message correctly', async () => {
        // Arrange
        const params = {
            messageId: '123',
            messageTimestamp: Date.now(),
            pushName: 'John Doe',
            message: {
                type: 'contacts',
                from: 'sender',
                contacts: [{ name: 'John Smith', phones: ['123456789'] }],
            },
            to: 'receiver',
            jwtToken: 'fakeToken',
            version: '1.0',
            numberId: '987',
        }

        // Act
        const result = await processIncomingMessage(params)

        // Assert
        expect(result).toEqual({
            type: 'contacts',
            from: 'sender',
            to: 'receiver',
            contacts: [
                {
                    name: 'John Smith',
                    phones: ['123456789'],
                },
            ],
            body: expect.any(String),
            pushName: 'John Doe',
            name: 'John Doe',
            message_id: '123',
            timestamp: expect.any(Number),
        })
    })

    test('should process order message correctly', async () => {
        // Arrange
        const params = {
            messageId: '123',
            messageTimestamp: Date.now(),
            pushName: 'John Doe',
            message: {
                type: 'order',
                from: 'sender',
                order: {
                    catalog_id: 'catalogId',
                    product_items: [{ id: 'productId', quantity: 2 }],
                },
            },
            to: 'receiver',
            jwtToken: 'fakeToken',
            version: '1.0',
            numberId: '987',
        }

        // Act
        const result = await processIncomingMessage(params)

        // Assert
        expect(result).toEqual({
            type: 'order',
            from: 'sender',
            to: 'receiver',
            order: {
                catalog_id: 'catalogId',
                product_items: [{ id: 'productId', quantity: 2 }],
            },
            body: expect.any(String),
            pushName: 'John Doe',
            name: 'John Doe',
            message_id: '123',
            timestamp: expect.any(Number),
        })
    })

    test('should handle unknown message type correctly', async () => {
        // Arrange
        const params = {
            messageId: '123',
            messageTimestamp: Date.now(),
            pushName: 'John Doe',
            message: {
                type: 'unknown',
                from: 'sender',
                unknownField: 'example',
            },
            to: 'receiver',
            jwtToken: 'fakeToken',
            version: '1.0',
            numberId: '987',
        }

        // Act
        const result = await processIncomingMessage(params)

        // Assert
        expect(result).toEqual({
            message_id: '123',
            timestamp: expect.any(Number),
        })
    })
})
