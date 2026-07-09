import type { MetaCallCoreVendor, WhatsAppCallEntryEvent } from '@builderbot/provider-voice'
import EventEmitter from 'node:events'
import type polka from 'polka'
import type Queue from 'queue-promise'

import { processIncomingMessage } from '../utils/processIncomingMsg'
import { extractMetaSignature, verifyMetaSignature } from '../utils/webhookSignature'

import type {
    ContactMeta,
    File,
    IncomingMessage,
    Message,
    MessageFromMeta,
    MessageStatus,
    MetaGlobalVendorArgs,
} from '~/types'

/**
 * Minimal request shape this vendor's middlewares actually read.
 *
 * `@types/polka`'s `Middleware` type is aliased to Express's `RequestHandler`, whose `Request`
 * carries many properties (and a wider `query`/`headers` shape) that don't reflect polka's actual
 * runtime request. Handlers below accept the untyped, context-inferred `req`/`res` from
 * `polka.Middleware` and cast once, at the top, to this precise shape — a single documented
 * boundary instead of `any` sprinkled through the function body.
 */
interface WebhookRequest {
    headers: Record<string, string | undefined>
    query?: Record<string, string | string[] | undefined>
    body: IncomingMessage
    /** Exact raw request bytes, captured by `ProviderClass.buildHTTPServer()`'s body-parser `verify` hook. */
    rawBody?: string
    globalVendorArgs?: MetaGlobalVendorArgs
}

/** Normalized `{ status, reason }` pair extracted from a webhook payload's message statuses. */
interface ExtractedStatus {
    status: string
    reason: string
}

/** Result of a single O(S) pass over webhook statuses. */
interface ExtractedStatuses {
    all: ExtractedStatus[]
    firstFailed: ExtractedStatus | undefined
}

/**
 * Class representing MetaCoreVendor, a vendor class for meta core functionality.
 * @extends EventEmitter
 */
export class MetaCoreVendor extends EventEmitter {
    queue: Queue
    /** Core vendor for WhatsApp Business voice calls — undefined when `enableVoiceCalls` is not set. */
    callVendor?: MetaCallCoreVendor

    /**
     * Create a MetaCoreVendor.
     * @param {Queue} _queue - The queue instance.
     * @param {MetaCallCoreVendor} [_callVendor] - Optional shared voice call core vendor.
     */
    constructor(_queue: Queue, _callVendor?: MetaCallCoreVendor) {
        super()
        this.queue = _queue
        this.callVendor = _callVendor
    }

    /**
     * Middleware function for indexing home.
     * @type {polka.Middleware}
     */
    public indexHome: polka.Middleware = (_, res) => {
        res.end('running ok')
    }

    /**
     * Check if the token is valid.
     * @param {string} mode - The mode parameter.
     * @param {string} token - The token parameter.
     * @param {string} originToken - The origin token parameter.
     * @returns {boolean} Returns true if token is valid, false otherwise.
     */
    public tokenIsValid(mode: string, token: string, originToken: string): boolean {
        return mode === 'subscribe' && originToken === token
    }

    /**
     * Flatten every `value.statuses[]` entry across all `entry[].changes[]` into a single list,
     * and capture the first `failed` status in the same O(S) pass.
     *
     * O(S) where S is the total number of status entries across the whole payload — every status
     * must be visited once because the 400 response serializes the full list; the first-failed
     * pointer is free during that walk (no second `.find`).
     *
     * Accepts a structural subset of the webhook body (rather than the full `IncomingMessage`)
     * since this only ever reads `entry[].changes[].value.statuses`.
     *
     * @param payload - The raw webhook body, or any object shaped like one.
     * @returns `{ all, firstFailed }` from a single linear pass.
     */
    private extractStatus(payload: {
        entry?: { changes?: { value?: { statuses?: MessageStatus[] } }[] }[]
    }): ExtractedStatuses {
        const entries = payload.entry ?? []
        const all: ExtractedStatus[] = []
        let firstFailed: ExtractedStatus | undefined

        for (const entry of entries) {
            for (const change of entry.changes ?? []) {
                for (const status of change.value?.statuses ?? []) {
                    const recipientId = status.recipient_id ?? status.recipient_user_id ?? 'N/A'
                    const errorDetails = status.errors?.[0]?.error_data?.details ?? 'Unknown'
                    const extracted: ExtractedStatus = {
                        status: status.status ?? 'Unknown',
                        reason: `Number(${recipientId}): ${errorDetails}`,
                    }
                    all.push(extracted)
                    if (!firstFailed && extracted.status === 'failed') {
                        firstFailed = extracted
                    }
                }
            }
        }

        return { all, firstFailed }
    }

    /**
     * Validate the `X-Hub-Signature-256` HMAC of an incoming webhook request.
     *
     * Prefers `req.rawBody` (the exact wire bytes); falls back to re-serializing the parsed
     * `body` with `JSON.stringify` — and emits a `notice` warning — only for unusual setups that
     * bypass the standard HTTP server and never populate `rawBody`.
     *
     * @param req - The incoming request (headers + optional captured raw body).
     * @param body - The already-parsed JSON body, used only as a fallback.
     * @param appSecret - The Meta App Secret configured for the app.
     * @returns `true` when the signature is present and valid.
     */
    private isWebhookSignatureValid(req: WebhookRequest, body: IncomingMessage, appSecret: string): boolean {
        const signature = extractMetaSignature(req.headers)
        if (!signature) return false

        if (req.rawBody) {
            return verifyMetaSignature(req.rawBody, signature, appSecret)
        }

        this.emit('notice', {
            title: '⚠️ META WEBHOOK WARNING',
            instructions: [
                'req.rawBody is missing — falling back to JSON.stringify(body) to verify the webhook signature.',
                'This fallback is not guaranteed to match the exact bytes Meta signed and may incorrectly reject valid webhooks.',
            ],
        })
        return verifyMetaSignature(JSON.stringify(body), signature, appSecret)
    }

    /**
     * Middleware function for verifying token.
     * @type {polka.Middleware}
     */
    public verifyToken: polka.Middleware = async (untypedReq, res) => {
        const req = untypedReq as unknown as WebhookRequest
        const mode = req.query?.['hub.mode']
        const token = req.query?.['hub.verify_token']
        const challenge = req.query?.['hub.challenge']
        const globalVendorArgs = req.globalVendorArgs

        if (typeof mode !== 'string' || typeof token !== 'string' || !mode || !token) {
            res.statusCode = 403
            res.end('No token!')
            return
        }

        if (!this.tokenIsValid(mode, token, globalVendorArgs?.verifyToken ?? '')) {
            res.statusCode = 403
            res.end('Invalid token!')
            return
        }

        this.emit('ready')
        res.statusCode = 200
        res.end(typeof challenge === 'string' ? challenge : '')
    }

    /**
     * Middleware function for handling incoming messages.
     * @type {polka.Middleware}
     */
    public incomingMsg: polka.Middleware = async (untypedReq, res) => {
        const req = untypedReq as unknown as WebhookRequest
        const globalVendorArgs = req.globalVendorArgs
        const body = req.body

        // Optional: validate Meta's `X-Hub-Signature-256` HMAC when `appSecret` is configured.
        // Applies to every webhook payload (messages and calls) before any other processing.
        if (globalVendorArgs?.appSecret && !this.isWebhookSignatureValid(req, body, globalVendorArgs.appSecret)) {
            this.emit('notice', {
                title: '🔒 META WEBHOOK WARNING',
                instructions: ['Invalid or missing X-Hub-Signature-256 — request rejected'],
            })
            res.statusCode = 401
            res.end(JSON.stringify({ error: 'Invalid webhook signature' }))
            return
        }

        // WhatsApp Business voice call events arrive as field: 'calls' — dispatch to the call
        // core vendor (when enabled via `enableVoiceCalls`) and always respond 200.
        // NOTE: compares against the raw string values (not the `CallEvent` enum) so this file
        // never needs a runtime import from `@builderbot/provider-voice` (see provider.ts for why).
        const callsChange = body?.entry?.[0]?.changes?.find((change) => change.field === 'calls')
        if (callsChange) {
            const calls: WhatsAppCallEntryEvent[] = callsChange.value?.calls ?? []
            if (this.callVendor) {
                for (const callEvent of calls) {
                    if (callEvent.event === 'connect') {
                        void this.callVendor.onConnect(callEvent)
                    } else if (callEvent.event === 'terminate') {
                        this.callVendor.onTerminate(callEvent.id)
                    }
                }
            }
            res.statusCode = 200
            res.end('OK')
            return
        }

        if (!globalVendorArgs) {
            res.statusCode = 200
            res.end('empty endpoint')
            return
        }

        const { jwtToken, numberId, version } = globalVendorArgs

        const { all: someErrors, firstFailed: findError } = this.extractStatus(body)

        if (findError) {
            this.emit('notice', {
                title: '🔔  META ALERT  🔔',
                instructions: [findError.reason],
            })
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(someErrors))
            return
        }

        const value = body?.entry?.[0]?.changes?.[0]?.value
        const messages = value?.messages
        const contacts = value?.contacts
        const messageId = messages?.[0]?.id
        const messageTimestamp = messages?.[0]?.timestamp
        if (!messages?.length) {
            res.statusCode = 200
            res.end('empty endpoint')
            return
        }

        // Hoist shared lookups once (O(1)) — Meta sends one contacts[] / metadata block per
        // change, so re-walking the same path inside the O(M) map is wasted work.
        const to = value?.metadata?.display_phone_number
        let contact: ContactMeta | undefined
        if (Array.isArray(contacts)) [contact] = contacts
        const pushName: string | undefined = contact?.profile?.name ?? 'Unknown'
        const userId: string | undefined = contact?.user_id

        try {
            // O(M) concurrent dispatch, where M is the number of messages in this webhook batch —
            // each message is downloaded/enriched and enqueued independently and in parallel.
            await Promise.all(
                messages.map(async (message: MessageFromMeta) => {
                    const fileData: File | null =
                        message.audio ?? message.image ?? message.video ?? message.document ?? message.sticker ?? null

                    const response: Message = await processIncomingMessage({
                        messageId,
                        messageTimestamp,
                        to,
                        pushName,
                        message,
                        fromMe: message.fromMe ?? false,
                        jwtToken,
                        numberId,
                        version,
                        fileData,
                        userId,
                    })
                    if (response) {
                        await this.queue.enqueue(() => this.processMessage(response))
                    }
                })
            )
            res.statusCode = 200
            res.end('Messages enqueued')
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'An error occurred while processing messages.'
            this.emit('notice', {
                title: '🔔  META ALERT  🔔',
                instructions: [errorMessage],
            })
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: errorMessage }))
        }
    }

    /**
     * Process incoming message.
     * @param {Message} message - The message object.
     * @returns {Promise<void>} Promise that resolves when processing is complete.
     */
    public processMessage = async (message: Message): Promise<void> => {
        this.emit('message', message)
    }
}
