import type { IncomingMessage, ServerResponse } from 'http'

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
    /** Maximum number of requests per window */
    maxRequests?: number
    /** Window size in milliseconds */
    windowMs?: number
    /** Message to return when rate limited */
    message?: string
    /** Skip rate limiting for certain paths */
    skipPaths?: string[]
    /** Custom key extractor (default: IP address) */
    keyExtractor?: (req: IncomingMessage) => string
}

/**
 * Rate limit entry
 */
interface RateLimitEntry {
    count: number
    resetTime: number
}

/**
 * Simple in-memory rate limiter
 */
export class RateLimiter {
    private config: Required<RateLimiterConfig>
    private store: Map<string, RateLimitEntry> = new Map()
    private cleanupInterval: ReturnType<typeof setInterval> | null = null

    constructor(config: RateLimiterConfig = {}) {
        this.config = {
            maxRequests: config.maxRequests ?? 100,
            windowMs: config.windowMs ?? 60000, // 1 minute
            message: config.message ?? 'Too many requests, please try again later',
            skipPaths: config.skipPaths ?? ['/docs', '/api/health'],
            keyExtractor: config.keyExtractor ?? this.defaultKeyExtractor,
        }

        // Cleanup expired entries every minute
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000)
    }

    /**
     * Default key extractor - uses IP address
     */
    private defaultKeyExtractor(req: IncomingMessage): string {
        const forwarded = req.headers['x-forwarded-for']
        if (forwarded) {
            const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]
            return ips.trim()
        }
        return req.socket?.remoteAddress || 'unknown'
    }

    /**
     * Check if request should be rate limited
     */
    isRateLimited(req: IncomingMessage): { limited: boolean; remaining: number; resetTime: number } {
        const url = req.url || '/'

        // Skip certain paths
        if (this.config.skipPaths.some((path) => url.startsWith(path))) {
            return { limited: false, remaining: this.config.maxRequests, resetTime: 0 }
        }

        const key = this.config.keyExtractor(req)
        const now = Date.now()

        let entry = this.store.get(key)

        // If no entry or window expired, create new entry
        if (!entry || now > entry.resetTime) {
            entry = {
                count: 1,
                resetTime: now + this.config.windowMs,
            }
            this.store.set(key, entry)
            return {
                limited: false,
                remaining: this.config.maxRequests - 1,
                resetTime: entry.resetTime,
            }
        }

        // Increment count
        entry.count++

        // Check if over limit
        if (entry.count > this.config.maxRequests) {
            return {
                limited: true,
                remaining: 0,
                resetTime: entry.resetTime,
            }
        }

        return {
            limited: false,
            remaining: this.config.maxRequests - entry.count,
            resetTime: entry.resetTime,
        }
    }

    /**
     * Create middleware function
     */
    middleware() {
        return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
            const result = this.isRateLimited(req)

            // Set rate limit headers
            res.setHeader('X-RateLimit-Limit', this.config.maxRequests.toString())
            res.setHeader('X-RateLimit-Remaining', result.remaining.toString())
            res.setHeader('X-RateLimit-Reset', result.resetTime.toString())

            if (result.limited) {
                res.setHeader('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000).toString())
                res.writeHead(429, { 'Content-Type': 'application/json' })
                res.end(
                    JSON.stringify({
                        error: this.config.message,
                        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
                    })
                )
                return
            }

            next()
        }
    }

    /**
     * Reset rate limit for a specific key
     */
    reset(key: string): void {
        this.store.delete(key)
    }

    /**
     * Clear all rate limit data
     */
    clear(): void {
        this.store.clear()
    }

    /**
     * Cleanup expired entries
     */
    private cleanup(): void {
        const now = Date.now()
        for (const [key, entry] of this.store.entries()) {
            if (now > entry.resetTime) {
                this.store.delete(key)
            }
        }
    }

    /**
     * Stop the cleanup interval
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval)
            this.cleanupInterval = null
        }
        this.store.clear()
    }

    /**
     * Get current stats
     */
    getStats(): { activeKeys: number; config: RateLimiterConfig } {
        return {
            activeKeys: this.store.size,
            config: this.config,
        }
    }
}
