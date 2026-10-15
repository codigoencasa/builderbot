/**
 * LAYER: Infrastructure
 * Contains: GoHighLevelCoreVendor, TokenManager, GHLGlobalVendorArgs, GHLIncomingWebhook
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [GoHighLevelCoreVendor, TokenManager, GHLGlobalVendorArgs, GHLIncomingWebhook]
 * GOAL: Own the "core" concern of the provider-gohighlevel package.
 */
import EventEmitter from 'node:events'
import type polka from 'polka'
import type Queue from 'queue-promise'

import { processIncomingMessage } from '../utils/processIncomingMsg'
import type { TokenManager } from '../utils/tokenManager'
import { verifyWebhookSignature, extractSignatureFromHeaders } from '../utils/webhookVerification'

import type { GHLGlobalVendorArgs, GHLIncomingWebhook, GHLMessage } from '~/types'

/**
 * Core vendor class handling OAuth callbacks and webhook processing
 * @internal
 */
export class GoHighLevelCoreVendor extends EventEmitter {
    queue: Queue
    tokenManager: TokenManager
    webhookSecret?: string

    constructor(_queue: Queue, _tokenManager: TokenManager, webhookSecret?: string) {
        super()
        this.queue = _queue
        this.tokenManager = _tokenManager
        this.webhookSecret = webhookSecret
    }

    public indexHome: polka.Middleware = (_, res) => {
        res.end('running ok')
    }

    public oauthCallback: polka.Middleware = async (req: any, res: any) => {
        const { query } = req
        const code = query?.code as string
        const globalVendorArgs = req['globalVendorArgs'] as GHLGlobalVendorArgs

        if (!code) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Missing authorization code' }))
            return
        }

        try {
            const tokens = await this.tokenManager.exchangeAuthorizationCode(code)
            this.emit('tokens_updated', tokens)

            // Show tokens for user to copy to their config
            this.emit('notice', {
                title: '🔑 OAuth Tokens - Copy to your config:',
                instructions: [
                    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
                    `accessToken: '${tokens.access_token}',`,
                    `refreshToken: '${tokens.refresh_token}',`,
                    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
                ],
            })

            this.emit('notice', {
                title: '✅ GHL Authorization Successful',
                instructions: [
                    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
                    `Location ID: ${tokens.locationId || globalVendorArgs?.locationId || 'N/A'}`,
                    `Channel: ${globalVendorArgs?.channelType || 'N/A'}`,
                    'Bot is ready to receive messages!',
                    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
                ],
            })
            this.emit('ready')
            res.statusCode = 200
            res.end(JSON.stringify({ message: 'Authorization successful', locationId: tokens.locationId }))
        } catch (error) {
            this.emit('notice', {
                title: '❌ GHL Authorization Failed',
                instructions: [error.message || 'Failed to exchange authorization code'],
            })
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'Failed to exchange authorization code' }))
        }
    }

    public incomingMsg: polka.Middleware = async (req: any, res: any) => {
        const body = req?.body as GHLIncomingWebhook

        // Debug log for incoming webhook
        console.log(
            '[GHL DEBUG] Webhook received:',
            JSON.stringify(
                {
                    type: body?.type,
                    contactId: body?.contactId,
                    phone: body?.phone,
                    messageType: body?.messageType,
                    direction: body?.direction,
                },
                null,
                2
            )
        )

        // Verify webhook signature if secret is configured
        if (this.webhookSecret) {
            const signature = extractSignatureFromHeaders(req.headers)
            const rawBody = req.rawBody || JSON.stringify(body)

            if (!signature) {
                this.emit('notice', {
                    title: 'GHL WEBHOOK WARNING',
                    instructions: ['Webhook signature missing from request headers'],
                })
                res.statusCode = 401
                res.end(JSON.stringify({ error: 'Missing webhook signature' }))
                return
            }

            if (!verifyWebhookSignature(rawBody, signature, this.webhookSecret)) {
                this.emit('notice', {
                    title: 'GHL WEBHOOK WARNING',
                    instructions: ['Invalid webhook signature - request rejected'],
                })
                res.statusCode = 401
                res.end(JSON.stringify({ error: 'Invalid webhook signature' }))
                return
            }
        }

        if (!body || !body.type) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Invalid webhook payload' }))
            return
        }

        try {
            const message = processIncomingMessage(body)

            if (message) {
                await this.queue.enqueue(() => this.processMessage(message))
            }

            res.statusCode = 200
            res.end(JSON.stringify({ success: true }))
        } catch (error) {
            this.emit('notice', {
                title: 'GHL WEBHOOK ERROR',
                instructions: [error.message || 'Error processing incoming message'],
            })
            res.statusCode = 400
            res.end(JSON.stringify({ error: error.message || 'Error processing webhook' }))
        }
    }

    public processMessage = (message: GHLMessage): Promise<void> => {
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
