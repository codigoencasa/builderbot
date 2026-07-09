import { ProviderClass } from '@builderbot/bot'
import type { BotContext, GlobalVendorArgs, SendOptions } from '@builderbot/bot/dist/types'
import axios, { type AxiosResponse } from 'axios'

import { resolveCommenterId, type TikTokComment, TikTokEvents } from './tiktok.events'

type AuthFailurePayload = {
    title: string
    instructions: string[]
    payload?: { qr?: string; code?: string }
}

/** Envelope returned by every TikTok Business Open API endpoint. */
type TikTokApiEnvelope<T = unknown> = {
    code: number
    message?: string
    data?: T
    request_id?: string
}

type TikTokCommentListData = {
    comments?: TikTokComment[]
    cursor?: number
    has_more?: boolean
}

type TikTokReplyData = {
    comment_id?: string
    text?: string
}

type PendingComment = {
    commentId: string
    videoId: string
    timestamp: number
}

type CommentTarget = {
    commentId: string
    videoId: string
}

type TikTokSendOptions = SendOptions & {
    comment?: {
        id?: string
        videoId?: string
    }
}

type TikTokApiError = Error & { tiktokCode?: number }

const TIKTOK_API_URL = 'https://business-api.tiktok.com/open_api/'
const RATE_LIMIT_CODE = 40100
const AXIOS_TIMEOUT_MS = 15_000

const ONE_HOUR_MS = 60 * 60 * 1000
const ONE_DAY_MS = 24 * ONE_HOUR_MS
const ONE_WEEK_MS = 7 * ONE_DAY_MS

/**
 * Bounded set with LRU eviction. Insertion order is oldest→newest.
 * Re-adding an existing key moves it to newest (touch).
 * Prevents the "cap then re-emit forever" bug of a plain Set that stops growing.
 */
export class LruSet {
    private readonly items = new Map<string, true>()

    constructor(private readonly maxSize: number) {
        if (maxSize < 1) throw new Error('LruSet maxSize must be >= 1')
    }

    get size(): number {
        return this.items.size
    }

    has(key: string): boolean {
        return this.items.has(key)
    }

    /** @returns true if the key was newly inserted (not already present). */
    add(key: string): boolean {
        if (this.items.has(key)) {
            this.items.delete(key)
            this.items.set(key, true)
            return false
        }
        if (this.items.size >= this.maxSize) {
            const oldest = this.items.keys().next().value
            if (oldest !== undefined) this.items.delete(oldest)
        }
        this.items.set(key, true)
        return true
    }
}

/** A video to watch, either as a bare id or with a known publish time for adaptive polling. */
export type TikTokVideoConfig = string | { id: string; createdAt?: number | string | Date }

export type TikTokArgs = GlobalVendorArgs & {
    /** TikTok Business API access token (`Access-Token` header). */
    accessToken: string
    /** TikTok Business account id (a.k.a. `open_id`) that owns the watched videos. */
    businessId: string
    /** Video ids to poll for new comments. Can be added later via {@link TikTokProvider.watchVideo}. */
    videos?: TikTokVideoConfig[]
    version?: string
    /** Poll interval (ms) used when a video's publish time is unknown. Default 60000. */
    pollIntervalMs?: number
    /** Max retry attempts on rate-limited (429) requests before giving up. Default 5. */
    maxRetries?: number
    /** Safety cap on tracked comment ids per video (LRU). Default 5000. */
    maxTrackedComments?: number
}

type NormalizedVideo = { id: string; createdAt?: number }

const DEFAULT_ARGS = {
    name: 'tiktok-bot',
    port: 3000,
    videos: [] as TikTokVideoConfig[],
    version: 'v1.3',
    pollIntervalMs: 60_000,
    maxRetries: 5,
    maxTrackedComments: 5000,
} as const

const toErrorMessage = (error: unknown): string => {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data
        if (typeof data === 'string' && data) return data
        if (data && typeof data === 'object') return JSON.stringify(data)
        return error.message
    }
    if (error instanceof Error) return error.message
    if (error && typeof error === 'object') {
        const maybe = error as { message?: unknown; response?: { data?: unknown } }
        if (typeof maybe.response?.data === 'string' && maybe.response.data) return maybe.response.data
        if (maybe.response?.data && typeof maybe.response.data === 'object') {
            return JSON.stringify(maybe.response.data)
        }
        if (typeof maybe.message === 'string' && maybe.message) return maybe.message
    }
    return String(error)
}

const getTikTokCode = (error: unknown): number | undefined => {
    if (!error || typeof error !== 'object') return undefined
    return (error as TikTokApiError).tiktokCode
}

const parseCreatedAt = (value?: number | string | Date): number | undefined => {
    if (value === undefined || value === null || value === '') return undefined
    const ms = new Date(value).getTime()
    if (Number.isNaN(ms)) return undefined
    return ms
}

/**
 * TikTokProvider — organic comment polling + public reply.
 *
 * P0 hardening:
 * - per-video inFlight lock (no concurrent double-emit)
 * - stop() clears timers/intervals
 * - auth gate: no polling after failed checkStatus
 * - LruSet for seen comment ids (no re-emit-at-cap)
 * @extends ProviderClass
 */
class TikTokProvider extends ProviderClass<TikTokEvents> {
    globalVendorArgs: TikTokArgs

    /** comment_id's already seen per video (LRU-bounded). */
    private seenComments = new Map<string, LruSet>()
    /** Max create_time (unix seconds) observed per video — emit gate after LRU eviction. */
    private watermarks = new Map<string, number>()

    /**
     * Tracks the most recent comment per commenter user id so that
     * `sendMessage(userId, ...)` knows which comment/video to reply to.
     */
    private pendingComments = new Map<string, PendingComment>()

    private pollTimers = new Map<string, ReturnType<typeof setTimeout>>()
    /** Videos currently being watched; separate from timers so stopWatching mid-poll cancels reschedule. */
    private activeVideos = new Set<string>()
    /** Prevents overlapping polls for the same videoId. */
    private inFlight = new Set<string>()
    /** Publish timestamps used by adaptive intervals (survives reschedule). */
    private videoCreatedAt = new Map<string, number | undefined>()
    private cleanupInterval?: ReturnType<typeof setInterval>
    private authenticated = false

    constructor(args?: TikTokArgs) {
        super()
        this.globalVendorArgs = { ...DEFAULT_ARGS, ...args }

        if (!this.globalVendorArgs.accessToken) {
            throw new Error('Must provide TikTok Access Token')
        }
        if (!this.globalVendorArgs.businessId) {
            throw new Error('Must provide TikTok Business ID')
        }
    }

    protected async initVendor(): Promise<TikTokEvents> {
        const vendor = new TikTokEvents()
        this.vendor = vendor

        const ok = await this.checkStatus()
        if (!ok) return vendor

        for (const video of this.normalizeVideos(this.globalVendorArgs.videos)) {
            this.schedulePoll(video.id, video.createdAt)
        }

        this.cleanupInterval = setInterval(() => this.cleanupPendingComments(), ONE_HOUR_MS)
        this.cleanupInterval.unref?.()

        return vendor
    }

    protected beforeHttpServerInit(): void {}

    protected afterHttpServerInit(): void {}

    /**
     * Stops polling and the HTTP server. Without this, timers keep hitting TikTok
     * after ProviderClass.stop() only closes the port.
     */
    public async stop(): Promise<void> {
        this.stopWatching()
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval)
            this.cleanupInterval = undefined
        }
        return super.stop()
    }

    busEvents = () => [
        {
            event: 'auth_failure',
            func: (payload: AuthFailurePayload) => this.emit('auth_failure', payload),
        },
        {
            event: 'ready',
            func: () => this.emit('ready', true),
        },
        {
            event: 'message',
            func: (payload: BotContext) => this.emit('message', payload),
        },
    ]

    private normalizeVideos(videos?: TikTokVideoConfig[]): NormalizedVideo[] {
        if (!videos?.length) return []

        return videos.map((video) => {
            if (typeof video === 'string') return { id: video }
            return { id: video.id, createdAt: parseCreatedAt(video.createdAt) }
        })
    }

    private getMaxTracked(): number {
        return this.globalVendorArgs.maxTrackedComments ?? DEFAULT_ARGS.maxTrackedComments
    }

    private getSeenSet(videoId: string): LruSet {
        let seen = this.seenComments.get(videoId)
        if (!seen) {
            seen = new LruSet(this.getMaxTracked())
            this.seenComments.set(videoId, seen)
        }
        return seen
    }

    /**
     * Adaptive poll interval based on video age:
     * - <1h: 60s | <24h: 5min | <7d: 30min | older/unknown: pollIntervalMs
     */
    private getPollIntervalMs = (createdAt?: number): number => {
        if (!createdAt) return this.globalVendorArgs.pollIntervalMs ?? DEFAULT_ARGS.pollIntervalMs

        const ageMs = Date.now() - createdAt
        if (ageMs < ONE_HOUR_MS) return 60_000
        if (ageMs < ONE_DAY_MS) return 5 * 60_000
        if (ageMs < ONE_WEEK_MS) return 30 * 60_000
        return ONE_DAY_MS
    }

    /**
     * Starts (or restarts) polling a video. If a poll is already in flight,
     * only updates metadata — the in-flight run will reschedule when done.
     */
    watchVideo = (videoId: string, createdAt?: number | string | Date): void => {
        if (!videoId) return
        if (!this.authenticated) {
            console.warn('[TikTok] Ignoring watchVideo: not authenticated')
            return
        }
        this.schedulePoll(videoId, parseCreatedAt(createdAt))
    }

    /** Stops polling a video (or all videos, if no id is given). */
    stopWatching = (videoId?: string): void => {
        if (videoId) {
            this.activeVideos.delete(videoId)
            this.videoCreatedAt.delete(videoId)
            clearTimeout(this.pollTimers.get(videoId))
            this.pollTimers.delete(videoId)
            return
        }

        this.activeVideos.clear()
        this.videoCreatedAt.clear()
        for (const timer of this.pollTimers.values()) clearTimeout(timer)
        this.pollTimers.clear()
    }

    private schedulePoll(videoId: string, createdAt?: number): void {
        this.activeVideos.add(videoId)
        this.videoCreatedAt.set(videoId, createdAt)
        clearTimeout(this.pollTimers.get(videoId))
        this.pollTimers.delete(videoId)

        // Overlap guard: don't start a second concurrent poll for the same video.
        if (this.inFlight.has(videoId)) return

        void this.runPoll(videoId)
    }

    private runPoll = async (videoId: string): Promise<void> => {
        if (!this.activeVideos.has(videoId)) return
        if (this.inFlight.has(videoId)) return

        this.inFlight.add(videoId)
        try {
            await this.pollVideoComments(videoId)
        } catch (error) {
            console.error('[TikTok] Error polling comments:', { videoId, error: toErrorMessage(error) })
        } finally {
            this.inFlight.delete(videoId)
        }

        if (!this.activeVideos.has(videoId)) return

        const createdAt = this.videoCreatedAt.get(videoId)
        const timer = setTimeout(() => {
            void this.runPoll(videoId)
        }, this.getPollIntervalMs(createdAt))
        timer.unref?.()
        this.pollTimers.set(videoId, timer)
    }

    /**
     * Fetches comment pages and diffs against the LRU seen set.
     * Subsequent polls stop at the first fully-seen page (newest-first).
     * First poll only builds a baseline (no events).
     *
     * Emit gate = create_time > watermark at poll start. That way an id that
     * falls out of the LRU and reappears on a page is not re-emitted.
     */
    private pollVideoComments = async (videoId: string): Promise<void> => {
        const isFirstPoll = !this.seenComments.has(videoId)
        const seen = this.getSeenSet(videoId)
        const watermarkAtStart = this.watermarks.get(videoId) ?? 0
        let maxCreateTime = watermarkAtStart

        const newComments: TikTokComment[] = []
        let cursor = 0
        let hasMore = true

        while (hasMore) {
            const page = await this.listComments(videoId, cursor)
            if (!page.comments.length) break

            let newOnPage = 0
            for (const comment of page.comments) {
                if (!comment.comment_id) continue

                const createTime = Number(comment.create_time) || 0
                if (createTime > maxCreateTime) maxCreateTime = createTime

                if (seen.has(comment.comment_id)) continue

                const inserted = seen.add(comment.comment_id)
                if (!inserted) continue
                newOnPage += 1

                // Only emit comments newer than the watermark established on prior polls.
                if (!isFirstPoll && createTime > watermarkAtStart) {
                    newComments.push(comment)
                }
            }

            // Early exit: a fully-seen page means older pages are already known.
            if (!isFirstPoll && newOnPage === 0) break

            cursor = page.cursor
            hasMore = page.hasMore
        }

        this.watermarks.set(videoId, maxCreateTime)

        if (!newComments.length) return

        // Emit oldest-first so downstream flows see comments in natural order.
        for (let i = newComments.length - 1; i >= 0; i -= 1) {
            const comment = newComments[i]
            this.pendingComments.set(resolveCommenterId(comment), {
                commentId: comment.comment_id,
                videoId,
                timestamp: Date.now(),
            })
            this.vendor.handleComment(comment, this.globalVendorArgs.businessId)
        }
    }

    private cleanupPendingComments(): void {
        const cutoff = Date.now() - ONE_WEEK_MS
        for (const [userId, entry] of this.pendingComments) {
            if (entry.timestamp >= cutoff) continue
            this.pendingComments.delete(userId)
        }
    }

    private requestWithBackoff = async <T>(
        fn: () => Promise<AxiosResponse<TikTokApiEnvelope<T>>>,
        attempt = 0
    ): Promise<AxiosResponse<TikTokApiEnvelope<T>>> => {
        try {
            const response = await fn()
            const body = response.data
            if (body && typeof body.code === 'number' && body.code !== 0) {
                const apiError: TikTokApiError = Object.assign(
                    new Error(body.message || `TikTok API error ${body.code}`),
                    { tiktokCode: body.code }
                )
                throw apiError
            }
            return response
        } catch (error) {
            const status = axios.isAxiosError(error) ? error.response?.status : undefined
            const isRateLimited = status === 429 || getTikTokCode(error) === RATE_LIMIT_CODE
            const maxRetries = this.globalVendorArgs.maxRetries ?? DEFAULT_ARGS.maxRetries
            if (!isRateLimited || attempt >= maxRetries) throw error

            const retryAfterHeader = axios.isAxiosError(error) ? error.response?.headers?.['retry-after'] : undefined
            const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN
            const baseDelay = Number.isFinite(retryAfterSec) ? retryAfterSec * 1000 : 2 ** attempt * 1000
            const jitter = Math.random() * 500
            await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter))

            return this.requestWithBackoff(fn, attempt + 1)
        }
    }

    listComments = async (
        videoId: string,
        cursor = 0
    ): Promise<{ comments: TikTokComment[]; cursor: number; hasMore: boolean }> => {
        if (!videoId) return { comments: [], cursor, hasMore: false }

        const url = `${TIKTOK_API_URL}${this.globalVendorArgs.version}/business/comment/list/`
        const response = await this.requestWithBackoff<TikTokCommentListData>(() =>
            axios.get(url, {
                headers: { 'Access-Token': this.globalVendorArgs.accessToken },
                timeout: AXIOS_TIMEOUT_MS,
                params: {
                    business_id: this.globalVendorArgs.businessId,
                    video_id: videoId,
                    cursor,
                    max_count: 20,
                },
            })
        )

        const data = response.data?.data
        return {
            comments: data?.comments ?? [],
            cursor: typeof data?.cursor === 'number' ? data.cursor : cursor,
            hasMore: Boolean(data?.has_more),
        }
    }

    replyToComment = async (videoId: string, commentId: string, text: string): Promise<TikTokReplyData | null> => {
        if (!videoId || !commentId) return null
        if (!text?.trim()) return null

        const url = `${TIKTOK_API_URL}${this.globalVendorArgs.version}/business/comment/reply/create/`
        try {
            const response = await this.requestWithBackoff<TikTokReplyData>(() =>
                axios.post(
                    url,
                    {
                        business_id: this.globalVendorArgs.businessId,
                        video_id: videoId,
                        comment_id: commentId,
                        text,
                    },
                    {
                        timeout: AXIOS_TIMEOUT_MS,
                        headers: {
                            'Access-Token': this.globalVendorArgs.accessToken,
                            'Content-Type': 'application/json',
                        },
                    }
                )
            )
            console.info('[TikTok] Reply sent successfully')
            return response.data?.data ?? null
        } catch (error) {
            console.error('[TikTok] Error replying to comment:', {
                error: toErrorMessage(error),
            })
            throw new Error('Failed to reply to comment')
        }
    }

    private resolveCommentTarget = (userId: string, options?: TikTokSendOptions): CommentTarget | null => {
        const explicitId = options?.comment?.id
        const explicitVideoId = options?.comment?.videoId
        if (explicitId && explicitVideoId) {
            return { commentId: explicitId, videoId: explicitVideoId }
        }

        return this.pendingComments.get(userId) ?? null
    }

    sendMessage = async <K = TikTokReplyData | null>(
        userId: string,
        message: string,
        options?: TikTokSendOptions
    ): Promise<K> => {
        if (!userId || !message?.trim()) return null as K

        const target = this.resolveCommentTarget(userId, options)
        if (!target) {
            console.warn(
                '[TikTok] No known comment for this user — TikTok has no DM API for organic comments, so a reply can only be posted under a comment.',
                { userId }
            )
            return null as K
        }

        return (await this.replyToComment(target.videoId, target.commentId, message)) as K
    }

    /** @returns true when the Business API accepts the credentials. */
    async checkStatus(): Promise<boolean> {
        try {
            const url = `${TIKTOK_API_URL}${this.globalVendorArgs.version}/business/get/`
            const response = await axios.get<TikTokApiEnvelope<{ username?: string; display_name?: string }>>(url, {
                headers: { 'Access-Token': this.globalVendorArgs.accessToken },
                timeout: AXIOS_TIMEOUT_MS,
                params: {
                    business_id: this.globalVendorArgs.businessId,
                    fields: JSON.stringify(['username', 'display_name']),
                },
            })

            if (response.data?.code !== 0) {
                throw new Error(response.data?.message || `Unexpected response code: ${response.data?.code}`)
            }

            console.info('[TikTok] Successfully authenticated with TikTok Business API')
            this.authenticated = true
            this.emit('ready', true)
            return true
        } catch (err) {
            this.authenticated = false
            console.error('[TikTok] Error checking status:', {
                error: toErrorMessage(err),
            })
            this.emit('auth_failure', {
                title: '❌ CONNECTION FAILED ❌',
                instructions: [
                    'Failed to authenticate with TikTok Business API',
                    'Please check your access token and business id',
                ],
                payload: { qr: 'no_need_qr' },
            })
            return false
        }
    }

    saveFile = async (_ctx?: Partial<BotContext>, _options?: { path: string }): Promise<string> => {
        console.warn('[TikTok] saveFile is a no-op: TikTok organic comments do not carry downloadable media.')
        return ''
    }
}

export { TikTokProvider }
