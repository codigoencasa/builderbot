import { describe, expect, jest, test, beforeEach } from '@jest/globals'
import axios from 'axios'

import type { Order } from '../src/types'
import { getOrderDetails } from '../src/utils'

jest.mock('axios')

const mockedGet = axios.get as jest.MockedFunction<typeof axios.get>

const BASE = 'https://graph.facebook.com'
const VERSION = 'v18.0'
const TOKEN = 'fake-jwt-token'

const CATALOG_ID = 'catalog_12345'

const ORDER: Order = {
    catalog_id: CATALOG_ID,
    text: 'Please deliver fast',
    product_items: [
        { product_retailer_id: 'SKU-001', quantity: 2, item_price: 19.99, currency: 'USD' },
        { product_retailer_id: 'SKU-002', quantity: 1, item_price: 9.5, currency: 'USD' },
    ],
}

describe('#getOrderDetails', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('should merge catalog data with webhook product_items', async () => {
        // Arrange
        mockedGet.mockImplementation((url: string) => {
            if (String(url).endsWith(CATALOG_ID)) {
                return Promise.resolve({ data: { name: 'My Store Catalog' } }) as any
            }
            return Promise.resolve({
                data: {
                    data: [
                        {
                            id: 'p1',
                            retailer_id: 'SKU-001',
                            name: 'Widget A',
                            image_url: 'https://cdn/a.jpg',
                            price: '$19.99',
                            currency: 'USD',
                        },
                        {
                            id: 'p2',
                            retailer_id: 'SKU-002',
                            name: 'Widget B',
                            image_url: 'https://cdn/b.jpg',
                            price: '$9.50',
                            currency: 'USD',
                        },
                    ],
                    paging: {},
                    summary: {},
                },
            }) as any
        })

        // Act
        const result = await getOrderDetails(VERSION, TOKEN, ORDER)

        // Assert
        expect(result.catalog_id).toBe(CATALOG_ID)
        expect(result.title).toBe('My Store Catalog')
        expect(result.text).toBe('Please deliver fast')

        expect(result.products).toHaveLength(2)
        expect(result.products[0]).toMatchObject({
            retailer_id: 'SKU-001',
            name: 'Widget A',
            imageUrl: 'https://cdn/a.jpg',
            quantity: 2,
            currency: 'USD',
        })
        expect(result.products[1]).toMatchObject({
            retailer_id: 'SKU-002',
            name: 'Widget B',
            imageUrl: 'https://cdn/b.jpg',
            quantity: 1,
            currency: 'USD',
        })

        // total = (19.99 * 2) + (9.5 * 1) = 49.48
        expect(result.price.total).toBe(49.48)
        expect(result.price.currency).toBe('USD')
    })

    test('should use correct Graph API URLs and params', async () => {
        // Arrange
        mockedGet.mockResolvedValue({ data: { name: 'Catalog', data: [] } } as any)

        // Act
        await getOrderDetails(VERSION, TOKEN, ORDER)

        // Assert
        expect(mockedGet).toHaveBeenNthCalledWith(
            1,
            `${BASE}/${VERSION}/${CATALOG_ID}`,
            expect.objectContaining({
                headers: { Authorization: `Bearer ${TOKEN}` },
                params: { fields: 'name' },
            })
        )
        expect(mockedGet).toHaveBeenNthCalledWith(
            2,
            `${BASE}/${VERSION}/${CATALOG_ID}/products`,
            expect.objectContaining({
                headers: { Authorization: `Bearer ${TOKEN}` },
                params: expect.objectContaining({
                    summary: true,
                    limit: 100,
                }),
            })
        )
    })

    test('should fall back to product_retailer_id as name when catalog product is missing', async () => {
        // Arrange — catalog returns empty products list
        mockedGet.mockImplementation((url: string) => {
            if (String(url).endsWith(CATALOG_ID)) {
                return Promise.resolve({ data: { name: 'My Catalog' } }) as any
            }
            return Promise.resolve({ data: { data: [] } }) as any
        })

        // Act
        const result = await getOrderDetails(VERSION, TOKEN, ORDER)

        // Assert
        expect(result.products[0].name).toBe('SKU-001')
        expect(result.products[0].imageUrl).toBe('')
        expect(result.products[0].price).toBe(19.99)
    })

    test('should return safe empty structure when order has no catalog_id', async () => {
        // Arrange
        const emptyOrder: Order = { catalog_id: '', product_items: [] }

        // Act
        const result = await getOrderDetails(VERSION, TOKEN, emptyOrder)

        // Assert
        expect(result.products).toHaveLength(0)
        expect(result.price.total).toBe(0)
        expect(result.title).toBe('')
        expect(mockedGet).not.toHaveBeenCalled()
    })

    test('should return safe empty structure when order has empty product_items', async () => {
        // Arrange
        const orderNoItems: Order = { catalog_id: CATALOG_ID, product_items: [] }

        // Act
        const result = await getOrderDetails(VERSION, TOKEN, orderNoItems)

        // Assert
        expect(result.products).toHaveLength(0)
        expect(result.price.total).toBe(0)
        expect(mockedGet).not.toHaveBeenCalled()
    })

    test('should return best-effort data when catalog name call fails', async () => {
        // Arrange
        mockedGet.mockImplementation((url: string) => {
            if (String(url).endsWith(CATALOG_ID)) {
                return Promise.reject(new Error('403 Forbidden')) as any
            }
            return Promise.resolve({
                data: {
                    data: [
                        {
                            id: 'p1',
                            retailer_id: 'SKU-001',
                            name: 'Widget A',
                            image_url: 'https://cdn/a.jpg',
                            price: '$19.99',
                            currency: 'USD',
                        },
                    ],
                },
            }) as any
        })

        // Act
        const result = await getOrderDetails(VERSION, TOKEN, ORDER)

        // Assert — title is empty but products still resolved
        expect(result.title).toBe('')
        expect(result.products[0].name).toBe('Widget A')
        expect(result.price.total).toBe(49.48)
    })

    test('should return fallback data when products call fails', async () => {
        // Arrange
        mockedGet.mockImplementation((url: string) => {
            if (String(url).endsWith(CATALOG_ID)) {
                return Promise.resolve({ data: { name: 'My Catalog' } }) as any
            }
            return Promise.reject(new Error('503 Service Unavailable')) as any
        })

        // Act
        const result = await getOrderDetails(VERSION, TOKEN, ORDER)

        // Assert — names fall back to retailer_id, prices come from webhook
        expect(result.title).toBe('My Catalog')
        expect(result.products[0].name).toBe('SKU-001')
        expect(result.products[0].imageUrl).toBe('')
        expect(result.products[0].price).toBe(19.99)
        expect(result.price.total).toBe(49.48)
    })

    test('should not throw when order object is null/undefined', async () => {
        // Act & Assert
        await expect(getOrderDetails(VERSION, TOKEN, null as any)).resolves.toMatchObject({
            catalog_id: '',
            title: '',
            products: [],
            price: { total: 0 },
        })
    })
})
