import { afterEach, beforeEach, describe, expect, jest, it } from '@jest/globals'

import { TikTokProvider } from '../src/tiktok.provider'

jest.mock('@builderbot/bot', () => ({
    ProviderClass: class {
        server = {
            post: jest.fn().mockReturnThis(),
            get: jest.fn().mockReturnThis(),
            server: { close: jest.fn((cb: (err?: Error) => void) => cb()) },
        }
        emit = jest.fn()
        vendor: any
        constructor() {}
        stop() {
            return Promise.resolve()
        }
    },
    EventEmitterClass: class {
        emit = jest.fn()
    },
    utils: {
        setEvent: jest.fn().mockReturnValue('_mock_tt_comment_event_'),
    },
}))

jest.mock('../src/tiktok.events', () => {
    const actual = jest.requireActual('../src/tiktok.events') as any
    return {
        ...actual,
        TikTokEvents: jest.fn().mockImplementation(() => ({
            handleComment: jest.fn(),
            emit: jest.fn(),
            on: jest.fn(),
            off: jest.fn(),
        })),
    }
})

jest.mock('axios', () => {
    const mockAxios = {
        get: jest.fn(),
        post: jest.fn(),
        isAxiosError: jest.fn().mockReturnValue(false),
    }
    return {
        __esModule: true,
        default: mockAxios,
        ...mockAxios,
    }
})

describe('TikTokProvider', () => {
    const mockConfig = {
        name: 'tiktok-test',
        port: 3000,
        accessToken: 'test-access-token',
        businessId: 'test-business-id',
        version: 'v1.3',
        videos: [],
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('Constructor', () => {
        it('should initialize with correct parameters', () => {
            const provider = new TikTokProvider(mockConfig)
            expect(provider).toBeDefined()
            expect(provider.globalVendorArgs.accessToken).toBe(mockConfig.accessToken)
            expect(provider.globalVendorArgs.businessId).toBe(mockConfig.businessId)
            expect(provider.globalVendorArgs.name).toBe(mockConfig.name)
        })

        it('should throw error when accessToken is missing', () => {
            expect(() => new TikTokProvider({ ...mockConfig, accessToken: undefined as any })).toThrow(
                'Must provide TikTok Access Token'
            )
        })

        it('should throw error when businessId is missing', () => {
            expect(() => new TikTokProvider({ ...mockConfig, businessId: undefined as any })).toThrow(
                'Must provide TikTok Business ID'
            )
        })

        it('should default pollIntervalMs, maxRetries and maxTrackedComments', () => {
            const provider = new TikTokProvider(mockConfig)
            expect(provider.globalVendorArgs.pollIntervalMs).toBe(60_000)
            expect(provider.globalVendorArgs.maxRetries).toBe(5)
            expect(provider.globalVendorArgs.maxTrackedComments).toBe(5000)
        })
    })

    describe('listComments', () => {
        let provider: TikTokProvider

        beforeEach(() => {
            provider = new TikTokProvider(mockConfig)
        })

        it('should list comments for a video', async () => {
            const axios = require('axios')
            axios.get.mockResolvedValue({
                data: {
                    code: 0,
                    data: {
                        comments: [{ comment_id: 'c1', text: 'hi', video_id: 'v1', create_time: '100' }],
                        cursor: 20,
                        has_more: true,
                    },
                },
            })

            const result = await provider.listComments('v1', 0)

            expect(axios.get).toHaveBeenCalledWith(
                `https://business-api.tiktok.com/open_api/${mockConfig.version}/business/comment/list/`,
                expect.objectContaining({
                    headers: { 'Access-Token': mockConfig.accessToken },
                    params: expect.objectContaining({ business_id: mockConfig.businessId, video_id: 'v1', cursor: 0 }),
                })
            )
            expect(result).toEqual({
                comments: [{ comment_id: 'c1', text: 'hi', video_id: 'v1', create_time: '100' }],
                cursor: 20,
                hasMore: true,
            })
        })

        it('should default to an empty page when the API returns no data', async () => {
            const axios = require('axios')
            axios.get.mockResolvedValue({ data: { code: 0, data: null } })

            const result = await provider.listComments('v1')

            expect(result).toEqual({ comments: [], cursor: 0, hasMore: false })
        })

        it('should throw when the API responds with a non-zero code', async () => {
            const axios = require('axios')
            axios.get.mockResolvedValue({ data: { code: 40002, message: 'video_id is invalid' } })

            await expect(provider.listComments('bad-video')).rejects.toThrow('video_id is invalid')
        })
    })

    describe('replyToComment', () => {
        let provider: TikTokProvider

        beforeEach(() => {
            provider = new TikTokProvider(mockConfig)
        })

        it('should post a public reply successfully', async () => {
            const axios = require('axios')
            axios.post.mockResolvedValue({
                data: { code: 0, data: { comment_id: 'reply_1', text: 'thanks!' } },
            })

            const result = await provider.replyToComment('v1', 'c1', 'thanks!')

            expect(axios.post).toHaveBeenCalledWith(
                `https://business-api.tiktok.com/open_api/${mockConfig.version}/business/comment/reply/create/`,
                {
                    business_id: mockConfig.businessId,
                    video_id: 'v1',
                    comment_id: 'c1',
                    text: 'thanks!',
                },
                expect.objectContaining({
                    headers: expect.objectContaining({ 'Access-Token': mockConfig.accessToken }),
                })
            )
            expect(result).toEqual({ comment_id: 'reply_1', text: 'thanks!' })
        })

        it('should throw a friendly error on failure', async () => {
            const axios = require('axios')
            axios.post.mockRejectedValue({
                response: { data: 'API Error' },
                message: 'Network error',
            })

            await expect(provider.replyToComment('v1', 'c1', 'hi')).rejects.toThrow('Failed to reply to comment')
        })
    })

    describe('sendMessage', () => {
        let provider: TikTokProvider

        beforeEach(() => {
            provider = new TikTokProvider(mockConfig)
        })

        it('should reply using an explicit comment target', async () => {
            const axios = require('axios')
            axios.post.mockResolvedValue({ data: { code: 0, data: { comment_id: 'reply_1' } } })

            const result = await provider.sendMessage('user123', 'hello', {
                comment: { id: 'c_explicit', videoId: 'v_explicit' },
            })

            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('/business/comment/reply/create/'),
                expect.objectContaining({ video_id: 'v_explicit', comment_id: 'c_explicit', text: 'hello' }),
                expect.anything()
            )
            expect(result).toEqual({ comment_id: 'reply_1' })
        })

        it('should reply using the last known comment for that user (pendingComments)', async () => {
            const axios = require('axios')
            axios.post.mockResolvedValue({ data: { code: 0, data: { comment_id: 'reply_2' } } })
            ;(provider as any).pendingComments.set('user_commenter', {
                commentId: 'c_pending',
                videoId: 'v_pending',
                timestamp: Date.now(),
            })

            const result = await provider.sendMessage('user_commenter', 'thanks for commenting!')

            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('/business/comment/reply/create/'),
                expect.objectContaining({ video_id: 'v_pending', comment_id: 'c_pending' }),
                expect.anything()
            )
            expect(result).toEqual({ comment_id: 'reply_2' })
        })

        it('should return null and warn when there is no known comment for that user', async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

            const result = await provider.sendMessage('unknown_user', 'hello?')

            expect(result).toBeNull()
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No known comment'), {
                userId: 'unknown_user',
            })

            warnSpy.mockRestore()
        })
    })

    describe('checkStatus', () => {
        let provider: TikTokProvider

        beforeEach(() => {
            provider = new TikTokProvider(mockConfig)
        })

        it('should emit ready on successful authentication', async () => {
            const axios = require('axios')
            axios.get.mockResolvedValue({ data: { code: 0, data: { username: 'leifermendez' } } })

            const ok = await provider.checkStatus()

            expect(ok).toBe(true)
            expect(provider.emit).toHaveBeenCalledWith('ready', true)
        })

        it('should emit auth_failure on a non-zero response code', async () => {
            const axios = require('axios')
            axios.get.mockResolvedValue({ data: { code: 40105, message: 'Access token is incorrect' } })

            const ok = await provider.checkStatus()

            expect(ok).toBe(false)
            expect(provider.emit).toHaveBeenCalledWith(
                'auth_failure',
                expect.objectContaining({ title: '❌ CONNECTION FAILED ❌' })
            )
        })

        it('should emit auth_failure on a network error', async () => {
            const axios = require('axios')
            axios.get.mockRejectedValue(new Error('Connection failed'))

            const ok = await provider.checkStatus()

            expect(ok).toBe(false)
            expect(provider.emit).toHaveBeenCalledWith(
                'auth_failure',
                expect.objectContaining({ title: '❌ CONNECTION FAILED ❌' })
            )
        })
    })

    describe('saveFile', () => {
        it('should always return an empty string (no media on organic comments)', async () => {
            const provider = new TikTokProvider(mockConfig)
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

            const result = await provider.saveFile()

            expect(result).toBe('')
            warnSpy.mockRestore()
        })
    })

    describe('pollVideoComments (private) — baseline + dedupe', () => {
        let provider: TikTokProvider

        beforeEach(() => {
            provider = new TikTokProvider(mockConfig)
            provider.vendor = { handleComment: jest.fn() } as any
        })

        it('should build a baseline on the first poll without emitting any comment', async () => {
            jest.spyOn(provider, 'listComments').mockResolvedValueOnce({
                comments: [
                    { comment_id: 'c1', text: 'old comment', video_id: 'v1', create_time: '100', user_id: 'u1' },
                ],
                cursor: 0,
                hasMore: false,
            })

            await (provider as any).pollVideoComments('v1')

            expect(provider.vendor.handleComment).not.toHaveBeenCalled()
        })

        it('should emit only genuinely new comments on subsequent polls', async () => {
            jest.spyOn(provider, 'listComments')
                .mockResolvedValueOnce({
                    comments: [
                        { comment_id: 'c1', text: 'old comment', video_id: 'v1', create_time: '100', user_id: 'u1' },
                    ],
                    cursor: 0,
                    hasMore: false,
                })
                .mockResolvedValueOnce({
                    comments: [
                        { comment_id: 'c1', text: 'old comment', video_id: 'v1', create_time: '100', user_id: 'u1' },
                        { comment_id: 'c2', text: 'new comment', video_id: 'v1', create_time: '200', user_id: 'u2' },
                    ],
                    cursor: 0,
                    hasMore: false,
                })

            await (provider as any).pollVideoComments('v1')
            await (provider as any).pollVideoComments('v1')

            expect(provider.vendor.handleComment).toHaveBeenCalledTimes(1)
            expect(provider.vendor.handleComment).toHaveBeenCalledWith(
                expect.objectContaining({ comment_id: 'c2' }),
                mockConfig.businessId
            )
        })

        it('should register a pendingComments entry for the commenter of a new comment', async () => {
            jest.spyOn(provider, 'listComments')
                .mockResolvedValueOnce({ comments: [], cursor: 0, hasMore: false })
                .mockResolvedValueOnce({
                    comments: [{ comment_id: 'c9', text: 'hi bot', video_id: 'v1', create_time: '300', user_id: 'u9' }],
                    cursor: 0,
                    hasMore: false,
                })

            await (provider as any).pollVideoComments('v1')
            await (provider as any).pollVideoComments('v1')

            const pending = (provider as any).pendingComments.get('u9')
            expect(pending).toMatchObject({ commentId: 'c9', videoId: 'v1' })
        })

        it('should stop paginating on the first fully-seen page (O(new) not O(history))', async () => {
            const listSpy = jest
                .spyOn(provider, 'listComments')
                .mockResolvedValueOnce({
                    comments: [{ comment_id: 'c1', text: 'old', video_id: 'v1', create_time: '100', user_id: 'u1' }],
                    cursor: 20,
                    hasMore: true,
                })
                .mockResolvedValueOnce({
                    comments: [{ comment_id: 'c0', text: 'older', video_id: 'v1', create_time: '50', user_id: 'u0' }],
                    cursor: 40,
                    hasMore: false,
                })
                // second poll: newest page is fully seen → must NOT fetch older pages
                .mockResolvedValueOnce({
                    comments: [{ comment_id: 'c1', text: 'old', video_id: 'v1', create_time: '100', user_id: 'u1' }],
                    cursor: 20,
                    hasMore: true,
                })

            await (provider as any).pollVideoComments('v1')
            expect(listSpy).toHaveBeenCalledTimes(2)

            await (provider as any).pollVideoComments('v1')
            expect(listSpy).toHaveBeenCalledTimes(3)
            expect(provider.vendor.handleComment).not.toHaveBeenCalled()
        })
    })

    describe('watchVideo / stopWatching', () => {
        let provider: TikTokProvider

        beforeEach(() => {
            jest.useFakeTimers()
            provider = new TikTokProvider(mockConfig)
            ;(provider as any).authenticated = true
            provider.vendor = { handleComment: jest.fn() } as any
            jest.spyOn(provider, 'listComments').mockResolvedValue({ comments: [], cursor: 0, hasMore: false })
        })

        afterEach(() => {
            provider.stopWatching()
            jest.useRealTimers()
        })

        it('should schedule a poll timer when watching a video', async () => {
            provider.watchVideo('v1')
            expect((provider as any).activeVideos.has('v1')).toBe(true)
            await jest.advanceTimersByTimeAsync(0)
            expect((provider as any).pollTimers.size).toBeGreaterThan(0)
        })

        it('should ignore empty video ids', () => {
            provider.watchVideo('')
            expect((provider as any).activeVideos.size).toBe(0)
        })

        it('should ignore watchVideo when not authenticated', () => {
            ;(provider as any).authenticated = false
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

            provider.watchVideo('v1')

            expect((provider as any).activeVideos.size).toBe(0)
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not authenticated'))
            warnSpy.mockRestore()
        })

        it('should clear the timer for a specific video on stopWatching(videoId)', async () => {
            provider.watchVideo('v1')
            await jest.advanceTimersByTimeAsync(0)
            provider.stopWatching('v1')
            expect((provider as any).pollTimers.has('v1')).toBe(false)
            expect((provider as any).activeVideos.has('v1')).toBe(false)
        })

        it('should clear all timers on stopWatching()', async () => {
            provider.watchVideo('v1')
            provider.watchVideo('v2')
            await jest.advanceTimersByTimeAsync(0)
            provider.stopWatching()
            expect((provider as any).pollTimers.size).toBe(0)
            expect((provider as any).activeVideos.size).toBe(0)
        })

        it('should not start a concurrent poll when already inFlight', async () => {
            let resolveFirst!: () => void
            const firstPoll = new Promise<void>((resolve) => {
                resolveFirst = resolve
            })
            const listSpy = jest.spyOn(provider, 'listComments').mockImplementation(async () => {
                await firstPoll
                return { comments: [], cursor: 0, hasMore: false }
            })

            provider.watchVideo('v1')
            provider.watchVideo('v1') // second call while first is in flight

            expect((provider as any).inFlight.has('v1')).toBe(true)
            expect(listSpy).toHaveBeenCalledTimes(1)

            resolveFirst()
            await jest.advanceTimersByTimeAsync(0)
        })
    })

    describe('stop()', () => {
        it('should clear poll timers and cleanup interval', async () => {
            jest.useFakeTimers()
            const provider = new TikTokProvider(mockConfig)
            ;(provider as any).authenticated = true
            jest.spyOn(provider, 'listComments').mockResolvedValue({ comments: [], cursor: 0, hasMore: false })

            provider.watchVideo('v1')
            await jest.advanceTimersByTimeAsync(0)
            ;(provider as any).cleanupInterval = setInterval(() => {}, 60_000)

            await provider.stop()

            expect((provider as any).pollTimers.size).toBe(0)
            expect((provider as any).activeVideos.size).toBe(0)
            expect((provider as any).cleanupInterval).toBeUndefined()
            jest.useRealTimers()
        })
    })

    describe('LruSet', () => {
        const { LruSet } = require('../src/tiktok.provider')

        it('should evict the oldest key when over capacity', () => {
            const set = new LruSet(2)
            expect(set.add('a')).toBe(true)
            expect(set.add('b')).toBe(true)
            expect(set.add('c')).toBe(true)

            expect(set.has('a')).toBe(false)
            expect(set.has('b')).toBe(true)
            expect(set.has('c')).toBe(true)
            expect(set.size).toBe(2)
        })

        it('should touch existing keys so they are not evicted next', () => {
            const set = new LruSet(2)
            set.add('a')
            set.add('b')
            expect(set.add('a')).toBe(false) // touch a → newest
            set.add('c') // evicts b (oldest)

            expect(set.has('a')).toBe(true)
            expect(set.has('b')).toBe(false)
            expect(set.has('c')).toBe(true)
        })

        it('should not re-emit after LRU eviction when an older id returns on the page', async () => {
            const provider = new TikTokProvider({ ...mockConfig, maxTrackedComments: 2 })
            provider.vendor = { handleComment: jest.fn() } as any

            // baseline: c2, c1 → watermark = 200
            jest.spyOn(provider, 'listComments')
                .mockResolvedValueOnce({
                    comments: [
                        { comment_id: 'c2', text: '2', video_id: 'v1', create_time: '200', user_id: 'u2' },
                        { comment_id: 'c1', text: '1', video_id: 'v1', create_time: '100', user_id: 'u1' },
                    ],
                    cursor: 0,
                    hasMore: false,
                })
                // c3 is new (create_time 300 > watermark). c2 may fall out of LRU but
                // create_time 200 <= watermark → must NOT re-emit.
                .mockResolvedValueOnce({
                    comments: [
                        { comment_id: 'c3', text: '3', video_id: 'v1', create_time: '300', user_id: 'u3' },
                        { comment_id: 'c2', text: '2', video_id: 'v1', create_time: '200', user_id: 'u2' },
                    ],
                    cursor: 0,
                    hasMore: false,
                })

            await (provider as any).pollVideoComments('v1')
            await (provider as any).pollVideoComments('v1')

            expect(provider.vendor.handleComment).toHaveBeenCalledTimes(1)
            expect(provider.vendor.handleComment).toHaveBeenCalledWith(
                expect.objectContaining({ comment_id: 'c3' }),
                mockConfig.businessId
            )
        })
    })

    describe('requestWithBackoff (private) — rate limit retry', () => {
        let provider: TikTokProvider

        beforeEach(() => {
            jest.useFakeTimers({ advanceTimers: true })
            provider = new TikTokProvider(mockConfig)
        })

        afterEach(() => {
            jest.useRealTimers()
        })

        it('should retry on a 429 and succeed once the rate limit clears', async () => {
            const axios = require('axios')
            axios.isAxiosError.mockReturnValue(true)

            const fn = jest
                .fn()
                .mockRejectedValueOnce({ response: { status: 429, headers: {} } })
                .mockResolvedValueOnce({ data: { code: 0, data: { ok: true } } })

            const promise = (provider as any).requestWithBackoff(fn)
            await jest.advanceTimersByTimeAsync(5000)
            const response = await promise

            expect(fn).toHaveBeenCalledTimes(2)
            expect((response as any).data.data).toEqual({ ok: true })
        })

        it('should give up after maxRetries and rethrow the error', async () => {
            const axios = require('axios')
            axios.isAxiosError.mockReturnValue(true)

            const rateLimitError = { response: { status: 429, headers: {} } }
            const fn = jest.fn().mockRejectedValue(rateLimitError)

            const promise = (provider as any).requestWithBackoff(fn)
            const expectation = expect(promise).rejects.toBe(rateLimitError)
            await jest.advanceTimersByTimeAsync(60_000)
            await expectation

            // maxRetries defaults to 5 → attempts 0..5 = 6 total calls before giving up
            expect(fn).toHaveBeenCalledTimes(6)
        })
    })
})
