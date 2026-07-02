import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { type AxiosError, type AxiosResponse } from 'axios'

// Mock axios before importing MetaCallClient so the module picks up the mock.
jest.mock('axios')

const axiosMock = require('axios') as {
    post: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>
}

import { MetaCallClient } from '../src/meta-call-client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CallBody {
    messaging_product: string
    action: string
    call_id: string
    session?: { sdp: string; sdp_type: string }
}

interface CallConfig {
    headers: { Authorization: string; 'Content-Type': string }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CALL_ID = 'test-call-123'
const SDP_ANSWER = 'v=0\r\na=setup:active\r\na=rtpmap:111 opus/48000/2\r\n'
const CLIENT_ARGS = {
    jwtToken: 'test-jwt-token',
    numberId: '123456789',
    version: 'v20.0',
}

/** Build a resolved AxiosResponse stub. */
const okResponse = (): AxiosResponse => ({
    data: { success: true },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: {} as AxiosResponse['config']['headers'] },
})

/** Build a rejected AxiosError stub with a given HTTP status. */
const axiosError = (status: number): AxiosError => {
    const err = new Error(`HTTP ${status}`) as AxiosError
    ;(err as unknown as { response: unknown }).response = { status, data: {} }
    ;(err as unknown as { isAxiosError: boolean }).isAxiosError = true
    return err
}

// ── Test suites ───────────────────────────────────────────────────────────────

describe('MetaCallClient', () => {
    let client: MetaCallClient

    beforeEach(() => {
        jest.clearAllMocks()
        client = new MetaCallClient(CLIENT_ARGS)
    })

    // ── FR-2 happy path: preAccept → accept ordering ──────────────────────────

    describe('preAccept → accept ordering (FR-2 happy path)', () => {
        test('calls preAccept before accept and both succeed in order', async () => {
            const callOrder: string[] = []
            const bodies: CallBody[] = []

            axiosMock.post.mockImplementation((_url, body) => {
                callOrder.push((body as CallBody).action)
                bodies.push(body as CallBody)
                return Promise.resolve(okResponse())
            })

            await client.preAccept(CALL_ID, SDP_ANSWER)
            await client.accept(CALL_ID, SDP_ANSWER)

            expect(callOrder).toEqual(['pre_accept', 'accept'])
            expect(axiosMock.post).toHaveBeenCalledTimes(2)
            expect(bodies[0].session?.sdp).toBe(SDP_ANSWER)
            expect(bodies[1].session?.sdp).toBe(SDP_ANSWER)
            expect(bodies[0].session?.sdp).toBe(bodies[1].session?.sdp)
        })

        test('preAccept sends SDP answer payload to the correct endpoint', async () => {
            axiosMock.post.mockResolvedValue(okResponse())

            await client.preAccept(CALL_ID, SDP_ANSWER)

            const [url, body, config] = axiosMock.post.mock.calls[0] as [string, CallBody, CallConfig]

            expect(url).toContain('/v20.0/123456789/calls')
            expect(body.action).toBe('pre_accept')
            expect(body.call_id).toBe(CALL_ID)
            expect(body.session?.sdp).toBe(SDP_ANSWER)
            expect(body.session?.sdp_type).toBe('answer')
            expect(config.headers.Authorization).toBe('Bearer test-jwt-token')
        })

        test('accept sends correct action with session body matching preAccept', async () => {
            axiosMock.post.mockResolvedValue(okResponse())

            await client.accept(CALL_ID, SDP_ANSWER)

            const [, body] = axiosMock.post.mock.calls[0] as [string, CallBody]
            expect(body.action).toBe('accept')
            expect(body.call_id).toBe(CALL_ID)
            expect(body.session?.sdp).toBe(SDP_ANSWER)
            expect(body.session?.sdp_type).toBe('answer')
        })
    })

    // ── FR-2 abort path: preAccept failure → accept NOT called ────────────────

    describe('preAccept failure aborts accept (FR-2 abort path)', () => {
        test('accept is never called when preAccept fails on 5xx', async () => {
            const actionsPosted: string[] = []
            const error500 = axiosError(500)

            axiosMock.post.mockImplementation((_url, body) => {
                actionsPosted.push((body as CallBody).action)
                return Promise.reject(error500)
            })

            await expect(client.preAccept(CALL_ID, SDP_ANSWER)).rejects.toThrow()

            const acceptCalls = actionsPosted.filter((a) => a === 'accept')
            expect(acceptCalls).toHaveLength(0)
        })

        test('retry fires exactly once on 5xx before re-throwing', async () => {
            const error500 = axiosError(500)
            axiosMock.post.mockRejectedValue(error500)

            await expect(client.preAccept(CALL_ID, SDP_ANSWER)).rejects.toThrow()

            // axios.post called exactly 2 times: initial attempt + 1 retry
            expect(axiosMock.post).toHaveBeenCalledTimes(2)
        }, 10000)
    })

    // ── No retry on 4xx ───────────────────────────────────────────────────────

    describe('no retry on 4xx errors', () => {
        test('preAccept throws immediately on 400 without retrying', async () => {
            axiosMock.post.mockRejectedValue(axiosError(400))

            await expect(client.preAccept(CALL_ID, SDP_ANSWER)).rejects.toThrow()

            // Only 1 call — no retry on 4xx
            expect(axiosMock.post).toHaveBeenCalledTimes(1)
        })

        test('accept throws immediately on 400 without retrying', async () => {
            axiosMock.post.mockRejectedValue(axiosError(400))

            await expect(client.accept(CALL_ID, SDP_ANSWER)).rejects.toThrow()

            // Only 1 call — no retry on 4xx
            expect(axiosMock.post).toHaveBeenCalledTimes(1)
        })

        test('throws immediately on 401 without retrying', async () => {
            axiosMock.post.mockRejectedValue(axiosError(401))

            await expect(client.reject(CALL_ID)).rejects.toThrow()
            expect(axiosMock.post).toHaveBeenCalledTimes(1)
        })
    })

    // ── end / reject methods ──────────────────────────────────────────────────

    describe('end and reject actions', () => {
        test('end sends correct action', async () => {
            axiosMock.post.mockResolvedValue(okResponse())

            await client.end(CALL_ID)

            const [, body] = axiosMock.post.mock.calls[0] as [string, CallBody]
            expect(body.action).toBe('end')
            expect(body.call_id).toBe(CALL_ID)
        })

        test('reject sends correct action', async () => {
            axiosMock.post.mockResolvedValue(okResponse())

            await client.reject(CALL_ID)

            const [, body] = axiosMock.post.mock.calls[0] as [string, CallBody]
            expect(body.action).toBe('reject')
            expect(body.call_id).toBe(CALL_ID)
        })
    })
})
