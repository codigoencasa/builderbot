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
                    list_reply: { id: 'row_id_1', title: 'List Reply' },
                },
            },
            to: 'receiver',
            jwtToken: 'fakeToken',
            version: '1.0',
            numberId: '987',
        }

        // Act
        const result = await processIncomingMessage(params)

        // Assert — button_reply takes priority over list_reply when both are present
        expect(result).toEqual({
            type: 'interactive',
            from: 'sender',
            to: 'receiver',
            body: 'Button Reply',
            title_button_reply: 'Button Reply',
            title_list_reply: 'List Reply',
            id_list_reply: 'row_id_1',
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
                // `id` is an internal row identifier (e.g. a random nanoid) unrelated to the
                // user-visible option text — `body` must resolve to `title`, not `id`, so
                // keyword/flow matching against the visible option text keeps working.
                interactive: {
                    list_reply: { id: 'row_id_2', title: 'List Reply' },
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
            title_list_reply: 'List Reply',
            id_list_reply: 'row_id_2',
            pushName: 'John Doe',
            nfm_reply: undefined,
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
        const stickerUrl = 'https://example.com/sticker.webp'
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

        ;(require('../src/utils/mediaUrl').getMediaUrl as jest.Mock).mockImplementation(() => stickerUrl)

        // Act
        const result = await processIncomingMessage(params)

        // Assert
        expect(result).toEqual({
            type: 'sticker',
            from: 'sender',
            to: 'receiver',
            id: 'stickerId',
            url: stickerUrl,
            fileData: undefined,
            fromMe: undefined,
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
        // Arrange — real Meta Cloud API order payload structure
        const params = {
            messageId: '123',
            messageTimestamp: Date.now(),
            pushName: 'John Doe',
            message: {
                type: 'order',
                from: 'sender',
                order: {
                    catalog_id: 'catalog_12345',
                    text: 'Please deliver fast',
                    product_items: [
                        {
                            product_retailer_id: 'sku-abc123',
                            quantity: 2,
                            item_price: 19.99,
                            currency: 'USD',
                        },
                        {
                            product_retailer_id: 'sku-def456',
                            quantity: 1,
                        },
                    ],
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
                catalog_id: 'catalog_12345',
                text: 'Please deliver fast',
                product_items: [
                    {
                        product_retailer_id: 'sku-abc123',
                        quantity: 2,
                        item_price: 19.99,
                        currency: 'USD',
                    },
                    {
                        product_retailer_id: 'sku-def456',
                        quantity: 1,
                    },
                ],
            },
            body: expect.any(String),
            pushName: 'John Doe',
            name: 'John Doe',
            message_id: '123',
            timestamp: expect.any(Number),
        })
    })

    test('should handle order message with minimal fields', async () => {
        // Arrange — Meta may send order without optional fields
        const params = {
            messageId: '456',
            messageTimestamp: Date.now(),
            pushName: 'Jane Doe',
            message: {
                type: 'order',
                from: 'sender',
                order: {
                    catalog_id: 'catalog_minimal',
                    product_items: [{ product_retailer_id: 'sku-1', quantity: 1 }],
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
        expect(result.order).toEqual({
            catalog_id: 'catalog_minimal',
            product_items: [{ product_retailer_id: 'sku-1', quantity: 1 }],
            text: undefined,
        })
    })

    test('should handle order message with missing order object gracefully', async () => {
        // Arrange — defensive: malformed webhook without order object
        const params = {
            messageId: '789',
            messageTimestamp: Date.now(),
            pushName: 'Ghost User',
            message: {
                type: 'order',
                from: 'sender',
            },
            to: 'receiver',
            jwtToken: 'fakeToken',
            version: '1.0',
            numberId: '987',
        }

        // Act
        const result = await processIncomingMessage(params)

        // Assert
        expect(result.order).toEqual({
            catalog_id: undefined,
            product_items: [],
            text: undefined,
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

    test('should propagate the BSUID userId from contact to the resulting Message', async () => {
        // Arrange
        const params = {
            messageId: '123',
            messageTimestamp: Date.now(),
            pushName: 'John Doe',
            message: { type: 'text', from: 'sender', text: { body: 'Hello' } },
            to: 'receiver',
            jwtToken: 'fakeToken',
            version: '1.0',
            numberId: '987',
            userId: 'US.13491208655302741918',
        }

        // Act
        const result = await processIncomingMessage(params)

        // Assert
        expect(result.userId).toBe('US.13491208655302741918')
    })

    test('should keep phone from intact when Meta sends it', async () => {
        const params = {
            messageId: '123',
            messageTimestamp: Date.now(),
            pushName: 'Jose Santos',
            message: { type: 'text', from: '573001112233', text: { body: 'ping' } },
            to: '573133324152',
            jwtToken: 'fakeToken',
            version: '1.0',
            numberId: '987',
            userId: 'CO.2177313826172406',
        }

        const result = await processIncomingMessage(params)

        expect(result.from).toBe('573001112233')
    })

    test('should resolve from from from_user_id when phone is omitted', async () => {
        const params = {
            messageId: 'wamid.test',
            messageTimestamp: '1785827662',
            pushName: 'Jose Santos',
            message: {
                type: 'text',
                from_user_id: 'CO.2177313826172406',
                text: { body: 'ping' },
            },
            to: '573133324152',
            jwtToken: 'fakeToken',
            version: '1.0',
            numberId: '987',
        }

        const result = await processIncomingMessage(params)

        expect(result.from).toBe('CO.2177313826172406')
    })

    test('should resolve from from userId when phone and from_user_id are omitted (Jose Santos fixture)', async () => {
        const params = {
            messageId: 'wamid.HBgTQ08uMjE3NzMxMzgyNjE3MjQwNhUUABIYIEFDQ0FFRDUxNzg0NERENjFBNTY1MEI0MTNCMkQ0MTY5AA==',
            messageTimestamp: '1785827662',
            pushName: 'Jose Santos',
            message: { type: 'text', text: { body: 'ping' } },
            to: '573133324152',
            jwtToken: 'fakeToken',
            version: '1.0',
            numberId: '987',
            userId: 'CO.2177313826172406',
            username: 'josesantos',
        }

        const result = await processIncomingMessage(params)

        expect(result.from).toBe('CO.2177313826172406')
        expect(result.userId).toBe('CO.2177313826172406')
        expect(result.username).toBe('josesantos')
        expect(result.body).toBe('ping')
    })

    test('should prefer phone over BSUID when both are present', async () => {
        const params = {
            messageId: '123',
            messageTimestamp: Date.now(),
            pushName: 'Jose Santos',
            message: {
                type: 'text',
                from: '573001112233',
                from_user_id: 'CO.2177313826172406',
                text: { body: 'ping' },
            },
            to: '573133324152',
            jwtToken: 'fakeToken',
            version: '1.0',
            numberId: '987',
            userId: 'CO.2177313826172406',
        }

        const result = await processIncomingMessage(params)

        expect(result.from).toBe('573001112233')
    })
})
