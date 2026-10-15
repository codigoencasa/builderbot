/**
 * LAYER: Infrastructure
 * Contains: getOrderDetails — Meta commerce order/catalog resolver
 * Rules: External HTTP client. Returns Domain order types.
 * BigO: O(n) score:3
 * keywords: [getOrderDetails, MetaOrderDetails, MetaProvider]
 * GOAL: Resolve order and catalog product details from the Meta Graph API.
 */
import axios from 'axios'

import type { Order, MetaOrderDetails, MetaOrderProduct } from '~/types'

const BASE_URL = 'https://graph.facebook.com'

const CATALOG_PRODUCT_FIELDS = [
    'name',
    'retailer_id',
    'image_url',
    'currency',
    'price',
    'description',
    'availability',
    'url',
]

/**
 * Parse a catalog price string like "$10.00" or "10.00 USD" into a number.
 * In read mode, Meta returns price as a string with currency symbol/code.
 */
const parseCatalogPrice = (raw: string | number | undefined): number => {
    if (typeof raw === 'number') return raw
    if (!raw) return 0
    const match = String(raw).replace(/[^\d.]/g, '')
    const parsed = parseFloat(match)
    return isNaN(parsed) ? 0 : parsed
}

/**
 * Retrieve the full order details for a WhatsApp catalog order by querying
 * the Meta Graph API.
 *
 * The WhatsApp webhook only delivers `catalog_id`, `product_retailer_id`,
 * `quantity`, `item_price`, and `currency` per item — it does NOT include
 * product names, images, or descriptions. This function resolves those fields
 * with two additional Graph API calls:
 *
 *  1. `GET /{catalog_id}?fields=name` — fetches the catalog title.
 *  2. `GET /{catalog_id}/products?fields=[...]&filter={"retailer_id":{"is_any":[...]}}` — fetches product details.
 *
 * Requires the access token to have `catalog_management` (or equivalent)
 * read permission on the catalog. If the calls fail, the function returns the
 * best-effort data available from the original webhook payload.
 *
 * @param version - Graph API version (e.g. "v18.0")
 * @param jwtToken - Meta access token (Bearer)
 * @param order - The `order` object from the incoming WhatsApp webhook message
 * @returns Enriched order details with product names, images, prices, and total
 * @example
 * addKeyword(EVENTS.ORDER).addAction(async (ctx, { provider }) => {
 *     const details = await provider.getOrderDetails(ctx.order)
 *     // details.title             — catalog name
 *     // details.products[].name  — product name from catalog
 *     // details.products[].imageUrl
 *     // details.products[].price
 *     // details.price.total      — sum of item_price * quantity
 *     // orderDate                — new Date(ctx.timestamp * 1000)
 * })
 */
const getOrderDetails = async (version: string, jwtToken: string, order: Order | null): Promise<MetaOrderDetails> => {
    const emptyResult: MetaOrderDetails = {
        catalog_id: order?.catalog_id ?? '',
        title: '',
        text: order?.text,
        price: { currency: '', total: 0 },
        products: [],
    }

    if (!order?.catalog_id || !order?.product_items?.length) {
        return emptyResult
    }

    const { catalog_id, product_items, text } = order
    const headers = { Authorization: `Bearer ${jwtToken}` }

    let catalogTitle = ''
    try {
        const catalogRes = await axios.get(`${BASE_URL}/${version}/${catalog_id}`, {
            headers,
            params: { fields: 'name' },
        })
        catalogTitle = catalogRes.data?.name ?? ''
    } catch (err) {
        console.log(`[getOrderDetails] Could not fetch catalog name for ${catalog_id}:`, err?.message ?? err)
    }

    const retailerIds = product_items.map((item) => item.product_retailer_id)
    let catalogProducts: Record<string, any>[] = []
    try {
        const productsRes = await axios.get(`${BASE_URL}/${version}/${catalog_id}/products`, {
            headers,
            params: {
                summary: true,
                limit: 100,
                fields: JSON.stringify(CATALOG_PRODUCT_FIELDS),
                filter: JSON.stringify({ retailer_id: { is_any: retailerIds } }),
            },
        })
        catalogProducts = productsRes.data?.data ?? []
    } catch (err) {
        console.log(`[getOrderDetails] Could not fetch products for catalog ${catalog_id}:`, err?.message ?? err)
    }

    const catalogMap = new Map<string, Record<string, any>>()
    for (const p of catalogProducts) {
        if (p.retailer_id) catalogMap.set(p.retailer_id, p)
    }

    let totalAmount = 0
    let totalCurrency = ''

    const products: MetaOrderProduct[] = product_items.map((item) => {
        const catalog = catalogMap.get(item.product_retailer_id)
        const itemPrice = item.item_price ?? 0
        const quantity = item.quantity ?? 1
        const currency = item.currency ?? catalog?.currency ?? ''

        totalAmount += itemPrice * quantity
        if (!totalCurrency && currency) totalCurrency = currency

        return {
            id: catalog?.id,
            retailer_id: item.product_retailer_id,
            name: catalog?.name ?? item.product_retailer_id,
            imageUrl: catalog?.image_url ?? '',
            price: catalog ? parseCatalogPrice(catalog.price) : itemPrice,
            currency,
            quantity,
        }
    })

    return {
        catalog_id,
        title: catalogTitle,
        text,
        price: {
            currency: totalCurrency,
            total: Math.round(totalAmount * 100) / 100,
        },
        products,
    }
}

export { getOrderDetails }
