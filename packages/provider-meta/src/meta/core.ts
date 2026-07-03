import { CallEvent } from '@builderbot/provider-voice'
import type { MetaCallCoreVendor } from '@builderbot/provider-voice'
import type { WhatsAppCallEntryEvent } from '@builderbot/provider-voice'
import EventEmitter from 'node:events'
import type polka from 'polka'
import type Queue from 'queue-promise'

import { processIncomingMessage } from '../utils/processIncomingMsg'
import { extractMetaSignature, verifyMetaSignature } from '../utils/webhookSignature'

import type { Message, MetaGlobalVendorArgs, IncomingMessage, ContactMeta } from '~/types'

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

    private extractStatus(obj: { entry: any }) {
        const entry = obj.entry || []
        const statusArray: { status: any; reason: string }[] = []

        entry.forEach((entryItem: { changes: any[] }) => {
            const changes = entryItem.changes || []
            changes.forEach((change) => {
                const values = change.value || {}
                const statuses = values.statuses || []
                statuses.forEach(
                    (status: {
                        recipient_id?: string
                        recipient_user_id?: string
                        errors: { error_data: { details: string } }[]
                        status: any
                    }) => {
                        const recipient_id = status.recipient_id || status.recipient_user_id || 'N/A'
                        const errorDetails = status.errors?.[0]?.error_data?.details || 'Unknown'
                        statusArray.push({
                            status: status.status || 'Unknown',
                            reason: `Number(${recipient_id}): ${errorDetails}`,
                        })
                    }
                )
            })
        })
        return statusArray
    }

    /**
     * Middleware function for verifying token.
     * @type {polka.Middleware}
     */
    public verifyToken: polka.Middleware = async (req: any, res: any) => {
        const { query } = req
        const mode: string = query?.['hub.mode']
        const token: string = query?.['hub.verify_token']
        const challenge = query?.['hub.challenge']
        const globalVendorArgs: MetaGlobalVendorArgs = req['globalVendorArgs'] ?? null

        if (!mode || !token) {
            res.statusCode = 403
            res.end('No token!')
            return
        }
        if (this.tokenIsValid(mode, token, globalVendorArgs?.verifyToken)) {
            this.emit('ready')
            res.statusCode = 200
            res.end(challenge)
            return
        }

        res.statusCode = 403
        res.end('Invalid token!')
    }

    /**
     * Middleware function for handling incoming messages.
     * @type {polka.Middleware}
     */
    public incomingMsg: polka.Middleware = async (req: any, res: any) => {
        const globalVendorArgs: MetaGlobalVendorArgs = req['globalVendorArgs'] ?? null
        const body = req?.body as IncomingMessage

        // Optional: validate Meta's `X-Hub-Signature-256` HMAC when `appSecret` is configured.
        // Applies to every webhook payload (messages and calls) before any other processing.
        if (globalVendorArgs?.appSecret) {
            const signature = extractMetaSignature(req.headers)
            const rawBody: string = req.rawBody || JSON.stringify(body)

            if (!signature || !verifyMetaSignature(rawBody, signature, globalVendorArgs.appSecret)) {
                this.emit('notice', {
                    title: '🔒 META WEBHOOK WARNING',
                    instructions: ['Invalid or missing X-Hub-Signature-256 — request rejected'],
                })
                res.statusCode = 401
                res.end(JSON.stringify({ error: 'Invalid webhook signature' }))
                return
            }
        }

        // WhatsApp Business voice call events arrive as field: 'calls' — dispatch to the call
        // core vendor (when enabled via `enableVoiceCalls`) and always respond 200.
        const callsChange = body?.entry?.[0]?.changes?.find((change: { field: string }) => change.field === 'calls')
        if (callsChange) {
            const calls: WhatsAppCallEntryEvent[] =
                (callsChange as { value?: { calls?: WhatsAppCallEntryEvent[] } }).value?.calls ?? []
            if (this.callVendor) {
                for (const callEvent of calls) {
                    if (callEvent.event === CallEvent.Connect) {
                        void this.callVendor.onConnect(callEvent)
                    } else if (callEvent.event === CallEvent.Terminate) {
                        this.callVendor.onTerminate(callEvent.id)
                    }
                }
            }
            res.statusCode = 200
            res.end('OK')
            return
        }

        const { jwtToken, numberId, version } = globalVendorArgs

        const someErrors = this.extractStatus(body)
        const findError = someErrors.find((s) => s.status === 'failed')

        if (findError) {
            this.emit('notice', {
                title: '🔔  META ALERT  🔔',
                instructions: [findError.reason],
            })
            res.writeHead(400, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify(someErrors))
        }

        const messages = body?.entry?.[0]?.changes?.[0]?.value?.messages
        const contacts = body?.entry?.[0]?.changes?.[0]?.value?.contacts
        const messageId = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id
        const messageTimestamp = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.timestamp
        if (!messages?.length) {
            res.statusCode = 200
            res.end('empty endpoint')
            return
        }

        try {
            await Promise.all(
                messages.map(async (message: any) => {
                    let contact: ContactMeta
                    if (Array.isArray(contacts)) [contact] = contacts
                    const to = body.entry[0].changes[0].value?.metadata?.display_phone_number
                    const pushName: string | undefined = contact?.profile?.name ?? 'Unknown'
                    const userId: string | undefined = contact?.user_id
                    const fileData =
                        message?.audio ??
                        message?.image ??
                        message?.video ??
                        message?.document ??
                        message?.sticker ??
                        (null as File | undefined)

                    const response: Message = await processIncomingMessage({
                        messageId,
                        messageTimestamp,
                        to,
                        pushName,
                        message,
                        fromMe: message?.fromMe ?? false,
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
        } catch (error) {
            this.emit('notice', {
                title: '🔔  META ALERT  🔔',
                instructions: [error.message || 'An error occurred while processing messages.'],
            })
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: error.message || 'An error occurred while processing messages.' }))
        }
    }

    /**
     * Process incoming message.
     * @param {Message} message - The message object.
     * @returns {Promise<void>} Promise that resolves when processing is complete.
     */
    public processMessage = (message: Message): Promise<void> => {
        return new Promise((resolve, reject) => {
            try {
                this.emit('message', message)
                resolve()
            } catch (error) {
                reject(error)
            }
        })
    }
}
