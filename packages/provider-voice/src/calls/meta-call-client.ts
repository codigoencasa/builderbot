/**
 * Thin axios client for the Meta Graph API `/calls` endpoint.
 *
 * Handles authentication, request construction, and a bounded retry policy
 * (one retry on 5xx / network error, 250ms delay). 4xx errors are never
 * retried and propagate immediately.
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/calling/
 */

import axios, { type AxiosError } from 'axios'

import { CallAction } from './types'
import type { CallActionBody } from './types'

const GRAPH_API_BASE = 'https://graph.facebook.com'
const RETRY_DELAY_MS = 250

/**
 * Arguments for constructing a `MetaCallClient`.
 */
export interface MetaCallClientArgs {
    /** Meta Graph API JWT (Bearer token). */
    jwtToken: string
    /** WhatsApp Business phone number ID. */
    numberId: string
    /** Graph API version, e.g. 'v20.0'. */
    version: string
}

/**
 * Client for the Meta Graph API WhatsApp Business calling endpoint.
 *
 * All methods enforce strict call-control ordering — the caller (core vendor)
 * is responsible for sequencing `preAccept` before `accept`. This client
 * simply executes the requested action with retry logic.
 *
 * @example
 * const client = new MetaCallClient({ jwtToken, numberId, version })
 * await client.preAccept(callId, sdpAnswer)
 * await client.accept(callId, sdpAnswer)
 */
export class MetaCallClient {
    private readonly jwtToken: string
    private readonly numberId: string
    private readonly version: string

    constructor(args: MetaCallClientArgs) {
        this.jwtToken = args.jwtToken
        this.numberId = args.numberId
        this.version = args.version
    }

    /**
     * Pre-accept an inbound call and exchange the SDP answer with Meta.
     *
     * This MUST be called (and must succeed) before {@link accept}. If this
     * call fails, the caller MUST NOT invoke {@link accept}.
     *
     * @param callId  The call identifier from the webhook `WhatsAppCallEntryEvent.id`.
     * @param sdpAnswer The transformed SDP answer (actpass → active, Opus confirmed).
     * @returns Resolves when Meta acknowledges the pre_accept.
     * @throws {Error} On HTTP 4xx (no retry) or after exhausting retries on 5xx / network errors.
     */
    public async preAccept(callId: string, sdpAnswer: string): Promise<void> {
        const body: CallActionBody = {
            messaging_product: 'whatsapp',
            action: CallAction.PreAccept,
            call_id: callId,
            session: {
                sdp: sdpAnswer,
                sdp_type: 'answer',
            },
        }
        await this.postWithRetry(body)
    }

    /**
     * Accept an inbound call that has already been pre-accepted.
     *
     * Must be called only after {@link preAccept} has resolved successfully.
     * Meta requires the same SDP answer that was sent in {@link preAccept}.
     *
     * @param callId The call identifier from the webhook.
     * @param sdpAnswer The transformed SDP answer — must match what was sent in `preAccept`.
     * @returns Resolves when Meta acknowledges the accept.
     * @throws {Error} On HTTP 4xx (no retry) or after exhausting retries on 5xx / network errors.
     */
    public async accept(callId: string, sdpAnswer: string): Promise<void> {
        const body: CallActionBody = {
            messaging_product: 'whatsapp',
            action: CallAction.Accept,
            call_id: callId,
            session: {
                sdp: sdpAnswer,
                sdp_type: 'answer',
            },
        }
        await this.postWithRetry(body)
    }

    /**
     * End an active call.
     *
     * @param callId The call identifier.
     * @returns Resolves when Meta acknowledges the end action.
     * @throws {Error} On HTTP 4xx (no retry) or after exhausting retries on 5xx / network errors.
     */
    public async end(callId: string): Promise<void> {
        const body: CallActionBody = {
            messaging_product: 'whatsapp',
            action: CallAction.End,
            call_id: callId,
        }
        await this.postWithRetry(body)
    }

    /**
     * Reject an inbound call before it is accepted.
     *
     * @param callId The call identifier.
     * @returns Resolves when Meta acknowledges the reject action.
     * @throws {Error} On HTTP 4xx (no retry) or after exhausting retries on 5xx / network errors.
     */
    public async reject(callId: string): Promise<void> {
        const body: CallActionBody = {
            messaging_product: 'whatsapp',
            action: CallAction.Reject,
            call_id: callId,
        }
        await this.postWithRetry(body)
    }

    /**
     * Send a call control action to the Meta Graph API with bounded retry.
     *
     * Retry policy: one retry after {@link RETRY_DELAY_MS}ms on 5xx or network
     * errors. 4xx errors are not retried and propagate immediately.
     *
     * @param body The request body conforming to `CallActionBody`.
     * @throws {Error} With a descriptive message including the action and status code.
     */
    private async postWithRetry(body: CallActionBody): Promise<void> {
        const url = `${GRAPH_API_BASE}/${this.version}/${this.numberId}/calls`
        const headers = {
            Authorization: `Bearer ${this.jwtToken}`,
            'Content-Type': 'application/json',
        }

        const attempt = async (): Promise<void> => {
            await axios.post(url, body, { headers })
        }

        try {
            await attempt()
        } catch (err) {
            const axiosErr = err as AxiosError
            const status = axiosErr.response?.status

            // Do not retry 4xx client errors — they indicate a logic or auth fault.
            if (status !== undefined && status >= 400 && status < 500) {
                throw new Error(
                    `[MetaCallClient] ${body.action} failed with HTTP ${status} for call_id="${body.call_id}". ` +
                        `This is a client error and will not be retried. ` +
                        `Response: ${JSON.stringify(axiosErr.response?.data)}`
                )
            }

            // Retry once for 5xx / network errors.
            await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS))

            try {
                await attempt()
            } catch (retryErr) {
                const retryAxiosErr = retryErr as AxiosError
                const retryStatus = retryAxiosErr.response?.status
                throw new Error(
                    `[MetaCallClient] ${body.action} failed after 1 retry for call_id="${body.call_id}". ` +
                        `HTTP ${retryStatus ?? 'network error'}. ` +
                        `Response: ${JSON.stringify(retryAxiosErr.response?.data)}`
                )
            }
        }
    }
}
