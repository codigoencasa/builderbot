import EventEmitter from 'node:events'
import type polka from 'polka'
import type Queue from 'queue-promise'

import { processIncomingMessage } from '../utils/processIncomingMsg'
import type { TokenManager } from '../utils/tokenManager'
import { verifyWebhookSignature, extractSignatureFromHeaders } from '../utils/webhookVerification'

import type { GHLGlobalVendorArgs, GHLIncomingWebhook, GHLMessage } from '~/types'

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

        if (!code) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Missing authorization code' }))
            return
        }

        try {
            const tokens = await this.tokenManager.exchangeAuthorizationCode(code)
            this.emit('tokens_updated', tokens)
            res.statusCode = 200
            res.end(JSON.stringify({ message: 'Authorization successful', locationId: tokens.locationId }))
        } catch (error) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'Failed to exchange authorization code' }))
        }
    }

    public incomingMsg: polka.Middleware = async (req: any, res: any) => {
        const body = req?.body as GHLIncomingWebhook

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
