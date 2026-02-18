import type { IncomingMessage, ServerResponse } from 'http'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { RateLimiter, type RateLimiterConfig } from '../src/rate-limiter'

// Helper to create mock request
const createMockRequest = (
    options: {
        url?: string
        ip?: string
        forwardedFor?: string
    } = {}
): IncomingMessage => {
    return {
        url: options.url ?? '/api/test',
        headers: {
            'x-forwarded-for': options.forwardedFor,
        },
        socket: {
            remoteAddress: options.ip ?? '127.0.0.1',
        },
    } as unknown as IncomingMessage
}

// Helper to create mock response
const createMockResponse = (): ServerResponse & {
    headers: Record<string, string>
    statusCode: number
    body: string
} => {
    const headers: Record<string, string> = {}
    let statusCode = 200
    let body = ''

    return {
        headers,
        statusCode,
        body,
        setHeader: (name: string, value: string) => {
            headers[name.toLowerCase()] = value
        },
        writeHead: (code: number) => {
            statusCode = code
        },
        end: (data?: string) => {
            body = data || ''
        },
    } as unknown as ServerResponse & { headers: Record<string, string>; statusCode: number; body: string }
}

// ============ Constructor Tests ============

test('RateLimiter - constructor with default config', () => {
    const limiter = new RateLimiter()

    const stats = limiter.getStats()
    assert.is(stats.config.maxRequests, 100)
    assert.is(stats.config.windowMs, 60000)
    assert.ok(stats.config.message?.includes('Too many requests'))

    limiter.destroy()
})

test('RateLimiter - constructor with custom config', () => {
    const limiter = new RateLimiter({
        maxRequests: 50,
        windowMs: 30000,
        message: 'Custom message',
    })

    const stats = limiter.getStats()
    assert.is(stats.config.maxRequests, 50)
    assert.is(stats.config.windowMs, 30000)
    assert.is(stats.config.message, 'Custom message')

    limiter.destroy()
})

test('RateLimiter - constructor with custom skipPaths', () => {
    const limiter = new RateLimiter({
        skipPaths: ['/custom/path', '/another/path'],
    })

    const stats = limiter.getStats()
    assert.ok(stats.config.skipPaths?.includes('/custom/path'))
    assert.ok(stats.config.skipPaths?.includes('/another/path'))

    limiter.destroy()
})

test('RateLimiter - constructor with custom keyExtractor', () => {
    const customExtractor = (req: IncomingMessage) => 'custom-key'
    const limiter = new RateLimiter({
        keyExtractor: customExtractor,
    })

    const stats = limiter.getStats()
    assert.is(stats.config.keyExtractor, customExtractor)

    limiter.destroy()
})

// ============ isRateLimited() Tests ============

test('RateLimiter - isRateLimited returns false for first request', () => {
    const limiter = new RateLimiter({ maxRequests: 10 })
    const req = createMockRequest()

    const result = limiter.isRateLimited(req)

    assert.is(result.limited, false)
    assert.is(result.remaining, 9)
    assert.ok(result.resetTime > Date.now())

    limiter.destroy()
})

test('RateLimiter - isRateLimited decrements remaining', () => {
    const limiter = new RateLimiter({ maxRequests: 10 })
    const req = createMockRequest()

    limiter.isRateLimited(req) // remaining: 9
    limiter.isRateLimited(req) // remaining: 8
    const result = limiter.isRateLimited(req) // remaining: 7

    assert.is(result.remaining, 7)

    limiter.destroy()
})

test('RateLimiter - isRateLimited returns true when limit exceeded', () => {
    const limiter = new RateLimiter({ maxRequests: 3 })
    const req = createMockRequest()

    limiter.isRateLimited(req) // 1
    limiter.isRateLimited(req) // 2
    limiter.isRateLimited(req) // 3
    const result = limiter.isRateLimited(req) // 4 - should be limited

    assert.is(result.limited, true)
    assert.is(result.remaining, 0)

    limiter.destroy()
})

test('RateLimiter - isRateLimited skips configured paths', () => {
    const limiter = new RateLimiter({
        maxRequests: 1,
        skipPaths: ['/docs', '/api/health'],
    })

    // These should be skipped
    const docsReq = createMockRequest({ url: '/docs' })
    const healthReq = createMockRequest({ url: '/api/health' })

    const docsResult = limiter.isRateLimited(docsReq)
    const healthResult = limiter.isRateLimited(healthReq)

    assert.is(docsResult.limited, false)
    assert.is(docsResult.remaining, 1) // Not decremented
    assert.is(healthResult.limited, false)

    limiter.destroy()
})

test('RateLimiter - isRateLimited uses IP address by default', () => {
    const limiter = new RateLimiter({ maxRequests: 2 })

    const req1 = createMockRequest({ ip: '192.168.1.1' })
    const req2 = createMockRequest({ ip: '192.168.1.2' })

    // Different IPs should have separate limits
    limiter.isRateLimited(req1)
    limiter.isRateLimited(req1)

    const result1 = limiter.isRateLimited(req1) // Should be limited
    const result2 = limiter.isRateLimited(req2) // Should NOT be limited

    assert.is(result1.limited, true)
    assert.is(result2.limited, false)

    limiter.destroy()
})

test('RateLimiter - isRateLimited uses x-forwarded-for header', () => {
    const limiter = new RateLimiter({ maxRequests: 2 })

    const req1 = createMockRequest({ forwardedFor: '10.0.0.1' })
    const req2 = createMockRequest({ forwardedFor: '10.0.0.2' })

    limiter.isRateLimited(req1)
    limiter.isRateLimited(req1)

    const result1 = limiter.isRateLimited(req1)
    const result2 = limiter.isRateLimited(req2)

    assert.is(result1.limited, true)
    assert.is(result2.limited, false)

    limiter.destroy()
})

test('RateLimiter - isRateLimited uses custom key extractor', () => {
    const limiter = new RateLimiter({
        maxRequests: 2,
        keyExtractor: (req) => (req.headers['x-user-id'] as string) || 'anonymous',
    })

    const req1 = { headers: { 'x-user-id': 'user1' }, url: '/api/test' } as unknown as IncomingMessage
    const req2 = { headers: { 'x-user-id': 'user2' }, url: '/api/test' } as unknown as IncomingMessage

    limiter.isRateLimited(req1)
    limiter.isRateLimited(req1)

    const result1 = limiter.isRateLimited(req1)
    const result2 = limiter.isRateLimited(req2)

    assert.is(result1.limited, true)
    assert.is(result2.limited, false)

    limiter.destroy()
})

test('RateLimiter - isRateLimited handles x-forwarded-for with multiple IPs', () => {
    const limiter = new RateLimiter({ maxRequests: 5 })

    const req = createMockRequest({ forwardedFor: '10.0.0.1, 10.0.0.2, 10.0.0.3' })

    const result = limiter.isRateLimited(req)

    // Should use first IP
    assert.is(result.limited, false)
    assert.is(result.remaining, 4)

    limiter.destroy()
})

// ============ middleware() Tests ============

test('RateLimiter - middleware allows request within limit', () => {
    const limiter = new RateLimiter({ maxRequests: 10 })
    const middleware = limiter.middleware()

    const req = createMockRequest()
    const res = createMockResponse()
    let nextCalled = false

    middleware(req, res as unknown as ServerResponse, () => {
        nextCalled = true
    })

    assert.is(nextCalled, true)
    assert.ok(res.headers['x-ratelimit-limit'])
    assert.ok(res.headers['x-ratelimit-remaining'])
    assert.ok(res.headers['x-ratelimit-reset'])

    limiter.destroy()
})

test('RateLimiter - middleware blocks request over limit', () => {
    const limiter = new RateLimiter({ maxRequests: 1 })
    const middleware = limiter.middleware()

    const req = createMockRequest()
    const res1 = createMockResponse()
    const res2 = createMockResponse()
    let nextCalled = false

    middleware(req, res1 as unknown as ServerResponse, () => {})
    middleware(req, res2 as unknown as ServerResponse, () => {
        nextCalled = true
    })

    assert.is(nextCalled, false)

    limiter.destroy()
})

test('RateLimiter - middleware sets rate limit headers', () => {
    const limiter = new RateLimiter({ maxRequests: 10 })
    const middleware = limiter.middleware()

    const req = createMockRequest()
    const res = createMockResponse()

    middleware(req, res as unknown as ServerResponse, () => {})

    assert.is(res.headers['x-ratelimit-limit'], '10')
    assert.is(res.headers['x-ratelimit-remaining'], '9')
    assert.ok(res.headers['x-ratelimit-reset'])

    limiter.destroy()
})

test('RateLimiter - middleware sets retry-after header when limited', () => {
    const limiter = new RateLimiter({ maxRequests: 1 })
    const middleware = limiter.middleware()

    const req = createMockRequest()
    const res1 = createMockResponse()
    const res2 = createMockResponse()

    middleware(req, res1 as unknown as ServerResponse, () => {})
    middleware(req, res2 as unknown as ServerResponse, () => {})

    assert.ok(res2.headers['retry-after'])

    limiter.destroy()
})

// ============ reset() Tests ============

test('RateLimiter - reset clears limit for specific key', () => {
    const limiter = new RateLimiter({ maxRequests: 1 })
    const req = createMockRequest({ ip: '192.168.1.1' })

    limiter.isRateLimited(req) // Use up limit
    limiter.isRateLimited(req) // Should be limited

    let result = limiter.isRateLimited(req)
    assert.is(result.limited, true)

    limiter.reset('192.168.1.1')

    result = limiter.isRateLimited(req)
    assert.is(result.limited, false)

    limiter.destroy()
})

test('RateLimiter - reset does nothing for non-existent key', () => {
    const limiter = new RateLimiter()

    // Should not throw
    limiter.reset('non-existent-key')

    const stats = limiter.getStats()
    assert.is(stats.activeKeys, 0)

    limiter.destroy()
})

// ============ clear() Tests ============

test('RateLimiter - clear removes all rate limit data', () => {
    const limiter = new RateLimiter({ maxRequests: 5 })

    // Add some entries
    limiter.isRateLimited(createMockRequest({ ip: '192.168.1.1' }))
    limiter.isRateLimited(createMockRequest({ ip: '192.168.1.2' }))
    limiter.isRateLimited(createMockRequest({ ip: '192.168.1.3' }))

    let stats = limiter.getStats()
    assert.is(stats.activeKeys, 3)

    limiter.clear()

    stats = limiter.getStats()
    assert.is(stats.activeKeys, 0)

    limiter.destroy()
})

// ============ destroy() Tests ============

test('RateLimiter - destroy clears all data and interval', () => {
    const limiter = new RateLimiter()

    limiter.isRateLimited(createMockRequest())

    limiter.destroy()

    const stats = limiter.getStats()
    assert.is(stats.activeKeys, 0)
})

test('RateLimiter - destroy can be called multiple times', () => {
    const limiter = new RateLimiter()

    limiter.destroy()
    limiter.destroy()
    limiter.destroy()

    // Should not throw
    assert.ok(true)
})

// ============ getStats() Tests ============

test('RateLimiter - getStats returns active keys count', () => {
    const limiter = new RateLimiter()

    let stats = limiter.getStats()
    assert.is(stats.activeKeys, 0)

    limiter.isRateLimited(createMockRequest({ ip: '1.1.1.1' }))
    limiter.isRateLimited(createMockRequest({ ip: '2.2.2.2' }))

    stats = limiter.getStats()
    assert.is(stats.activeKeys, 2)

    limiter.destroy()
})

test('RateLimiter - getStats returns config', () => {
    const limiter = new RateLimiter({
        maxRequests: 50,
        windowMs: 30000,
        message: 'Test message',
    })

    const stats = limiter.getStats()

    assert.is(stats.config.maxRequests, 50)
    assert.is(stats.config.windowMs, 30000)
    assert.is(stats.config.message, 'Test message')

    limiter.destroy()
})

// ============ Window Expiration Tests ============

test('RateLimiter - resets after window expires', async () => {
    const limiter = new RateLimiter({
        maxRequests: 1,
        windowMs: 100, // 100ms window for testing
    })
    const req = createMockRequest()

    limiter.isRateLimited(req)
    let result = limiter.isRateLimited(req)
    assert.is(result.limited, true)

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 150))

    result = limiter.isRateLimited(req)
    assert.is(result.limited, false)

    limiter.destroy()
})

// ============ Edge Cases ============

test('RateLimiter - handles missing URL', () => {
    const limiter = new RateLimiter()

    const req = { headers: {}, socket: { remoteAddress: '127.0.0.1' } } as unknown as IncomingMessage

    const result = limiter.isRateLimited(req)

    assert.is(result.limited, false)

    limiter.destroy()
})

test('RateLimiter - handles missing remote address', () => {
    const limiter = new RateLimiter()

    const req = { url: '/api/test', headers: {}, socket: {} } as unknown as IncomingMessage

    // Should use 'unknown' as key
    const result = limiter.isRateLimited(req)

    assert.is(result.limited, false)

    limiter.destroy()
})

test('RateLimiter - handles maxRequests of 0', () => {
    const limiter = new RateLimiter({ maxRequests: 0 })
    const req = createMockRequest()

    // First request creates entry with count=1, which is > 0 (maxRequests)
    // So it will be limited on the second check
    const result1 = limiter.isRateLimited(req)
    const result2 = limiter.isRateLimited(req)

    // First request passes (remaining = -1), second is limited
    assert.is(result2.limited, true)
    assert.is(result2.remaining, 0)

    limiter.destroy()
})

test('RateLimiter - handles very large maxRequests', () => {
    const limiter = new RateLimiter({ maxRequests: 1000000 })
    const req = createMockRequest()

    const result = limiter.isRateLimited(req)

    assert.is(result.limited, false)
    assert.is(result.remaining, 999999)

    limiter.destroy()
})

test('RateLimiter - handles skipPaths with partial match', () => {
    const limiter = new RateLimiter({
        maxRequests: 1,
        skipPaths: ['/api/docs'],
    })

    // Should skip because it starts with /api/docs
    const req = createMockRequest({ url: '/api/docs/swagger' })

    limiter.isRateLimited(req)
    const result = limiter.isRateLimited(req)

    // Should still not be limited because path is skipped
    assert.is(result.limited, false)

    limiter.destroy()
})

test('RateLimiter - concurrent requests from same IP', () => {
    const limiter = new RateLimiter({ maxRequests: 5 })
    const req = createMockRequest({ ip: '192.168.1.1' })

    // Simulate 10 concurrent requests
    const results = []
    for (let i = 0; i < 10; i++) {
        results.push(limiter.isRateLimited(req))
    }

    // First 5 should pass, rest should be limited
    const passed = results.filter((r) => !r.limited).length
    const limited = results.filter((r) => r.limited).length

    assert.is(passed, 5)
    assert.is(limited, 5)

    limiter.destroy()
})

test('RateLimiter - middleware returns correct JSON response when limited', () => {
    const limiter = new RateLimiter({
        maxRequests: 1,
        message: 'Rate limit exceeded',
    })
    const middleware = limiter.middleware()

    const req = createMockRequest()

    // Create better mock response that captures body correctly
    let capturedBody = ''
    const res1 = {
        setHeader: () => {},
        writeHead: () => {},
        end: (data?: string) => {
            capturedBody = data || ''
        },
    } as unknown as ServerResponse

    const res2 = {
        setHeader: () => {},
        writeHead: () => {},
        end: (data?: string) => {
            capturedBody = data || ''
        },
    } as unknown as ServerResponse

    middleware(req, res1, () => {})
    middleware(req, res2, () => {})

    // Parse the response body
    const body = JSON.parse(capturedBody)

    assert.is(body.error, 'Rate limit exceeded')
    assert.ok(body.retryAfter)

    limiter.destroy()
})

test.run()
