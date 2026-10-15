/**
 * LAYER: Infrastructure
 * Contains: Core, GupshupCoreVendor
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(n^2) score:1
 * keywords: [Core, GupshupCoreVendor]
 * GOAL: Own the "core" concern of the provider-gupshup package.
 */
import EventEmitter from 'node:events'
import type polka from 'polka'

import type {
    GupshupCloudChangeValue,
    GupshupCloudContact,
    GupshupCloudStatus,
    GupshupCloudWebhookBody,
    GupshupGlobalVendorArgs,
} from '../types'
import { processIncomingMessage } from '../utils/processIncomingMsg'

const DEFAULT_WEBHOOK_DEDUPE_TTL_MS = 5 * 60 * 1000
const MISSING_WEBHOOK_VERIFY_WARNING = [
    'Webhook verification is disabled.',
    'Configure webhook.verify to validate request authenticity and protect this endpoint.',
]

export class GupshupCoreVendor extends EventEmitter {
    private readonly seenInboundMessageIds = new Map<string, number>()
    private readonly inFlightInboundMessageIds = new Set<string>()
    private hasEmittedMissingVerifyWarning = false

    constructor(private args: GupshupGlobalVendorArgs) {
        super()
    }

    private getDedupeTtlMs = (): number => {
        const configuredValue = this.args.webhook?.dedupeTtlMs

        if (typeof configuredValue !== 'number' || configuredValue <= 0) {
            return DEFAULT_WEBHOOK_DEDUPE_TTL_MS
        }

        return configuredValue
    }

    private pruneSeenInboundMessages = (now: number): void => {
        const dedupeTtlMs = this.getDedupeTtlMs()

        for (const [messageId, expiresAt] of this.seenInboundMessageIds) {
            if (expiresAt <= now) {
                this.seenInboundMessageIds.delete(messageId)
            }
        }
    }

    private shouldProcessInboundMessage = (messageId?: string): boolean => {
        if (!messageId) return true

        const now = Date.now()
        this.pruneSeenInboundMessages(now)

        const currentExpiry = this.seenInboundMessageIds.get(messageId)
        if (typeof currentExpiry === 'number' && currentExpiry > now) {
            return false
        }

        if (this.inFlightInboundMessageIds.has(messageId)) {
            return false
        }

        this.inFlightInboundMessageIds.add(messageId)

        return true
    }

    private releaseInboundMessageReservation = (messageId?: string): void => {
        if (!messageId) return
        this.inFlightInboundMessageIds.delete(messageId)
    }

    private markInboundMessageAsSeen = (messageId?: string): void => {
        if (!messageId) return

        const now = Date.now()
        this.pruneSeenInboundMessages(now)
        this.seenInboundMessageIds.set(messageId, now + this.getDedupeTtlMs())
    }

    private emitMissingVerifyWarningOnce = (): void => {
        if (this.hasEmittedMissingVerifyWarning) return
        if (this.args.webhook?.verify) return

        this.hasEmittedMissingVerifyWarning = true
        this.emitNoticeSafely({
            title: '🟠  GUPSHUP SECURITY NOTICE  🟠',
            instructions: MISSING_WEBHOOK_VERIFY_WARNING,
        })
    }

    private emitStatusSafely = (payload: Record<string, unknown>): void => {
        try {
            this.emit('status', payload)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown status listener error'
            console.error('[Gupshup] Error dispatching status event:', errorMessage)
        }
    }

    private emitNoticeSafely = (payload: Record<string, unknown>): void => {
        try {
            this.emit('notice', payload)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown notice listener error'
            console.error('[Gupshup] Error dispatching notice event:', errorMessage)
        }
    }

    private shouldLogInbound = (): boolean => {
        return this.args.logs?.inbound ?? false
    }

    private shouldLogStatus = (statusName: string): boolean => {
        const statusLogMode = this.args.logs?.status ?? 'failed'

        if (statusLogMode === 'all') return true
        if (statusLogMode === 'failed') return statusName === 'failed'

        return false
    }

    private shouldIncludeRawFailedStatus = (): boolean => {
        return this.args.logs?.rawOnFailed ?? false
    }

    private serializeStatus = (status: GupshupCloudStatus): string => {
        try {
            return JSON.stringify(status)
        } catch {
            return 'Unable to serialize status payload'
        }
    }

    private extractStatusReasons = (status: GupshupCloudStatus): string[] => {
        if (!status.errors?.length) return ['No additional details']

        return status.errors
            .map((error) => {
                return error.error_data?.details ?? error.details ?? error.title ?? error.message
            })
            .filter((errorReason): errorReason is string => Boolean(errorReason))
    }

    private processStatuses = (value?: GupshupCloudChangeValue): void => {
        if (!value?.statuses?.length) return

        for (const status of value.statuses) {
            const statusName = status.status ?? 'unknown'
            const recipient = status.recipient_id ?? 'unknown'

            this.emitStatusSafely({
                ...status,
                status: statusName,
                recipient,
            })

            if (!this.shouldLogStatus(statusName)) continue

            if (statusName === 'failed') {
                const instructions = [
                    `Status: ${statusName}`,
                    `Recipient: ${recipient}`,
                    ...this.extractStatusReasons(status),
                ]

                if (this.shouldIncludeRawFailedStatus()) {
                    instructions.push(`Raw: ${this.serializeStatus(status)}`)
                }

                this.emitNoticeSafely({
                    title: '🔔  GUPSHUP ALERT  🔔',
                    instructions,
                })
                continue
            }

            this.emitNoticeSafely({
                title: '📨  GUPSHUP STATUS',
                instructions: [`Status: ${statusName}`, `Recipient: ${recipient}`],
            })
        }
    }

    private findContact = (contacts: GupshupCloudContact[] = [], from?: string): GupshupCloudContact | undefined => {
        if (!contacts.length) return undefined
        if (!from) return contacts[0]

        return contacts.find((contact) => contact.wa_id === from) ?? contacts[0]
    }

    private processChangeValue = async (value?: GupshupCloudChangeValue): Promise<void> => {
        if (!value?.messages?.length) return

        for (const message of value.messages) {
            if (!this.shouldProcessInboundMessage(message.id)) continue

            try {
                const botContext = await processIncomingMessage(
                    {
                        message,
                        contact: this.findContact(value.contacts, message.from),
                        metadata: value.metadata,
                    },
                    this.args
                )

                if (botContext) {
                    if (this.shouldLogInbound()) {
                        this.emitNoticeSafely({
                            title: '📩  GUPSHUP INBOUND',
                            instructions: [
                                `From: ${botContext.from}`,
                                `Type: ${message.type ?? 'unknown'}`,
                                `Body: ${botContext.body}`,
                            ],
                        })
                    }
                    this.emit('message', botContext)
                    this.markInboundMessageAsSeen(message.id)
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown inbound processing error'
                console.error(
                    `[Gupshup] Error processing inbound message ${message.id ?? '(without id)'}:`,
                    errorMessage
                )
            } finally {
                this.releaseInboundMessageReservation(message.id)
            }
        }
    }

    public incomingMsg: polka.Middleware = async (req: any, res: any) => {
        try {
            this.emitMissingVerifyWarningOnce()

            const verifyWebhook = this.args.webhook?.verify
            if (verifyWebhook) {
                const isAllowed = await verifyWebhook(req)

                if (!isAllowed) {
                    res.statusCode = 401
                    res.end('Unauthorized')
                    return
                }
            }

            const body = req.body as GupshupCloudWebhookBody | undefined
            const entries = body?.entry

            if (!entries?.length) {
                res.statusCode = 200
                res.end('OK')
                return
            }

            for (const entry of entries) {
                if (!entry.changes?.length) continue

                for (const change of entry.changes) {
                    if (change.field && !['messages', 'statuses'].includes(change.field)) continue
                    this.processStatuses(change.value)
                    await this.processChangeValue(change.value)
                }
            }

            res.statusCode = 200
            res.end('OK')
        } catch (e) {
            console.error('Webhook Error:', e)
            res.statusCode = 500
            res.end('Error')
        }
    }
}
