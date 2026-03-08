import EventEmitter from 'node:events'
import type polka from 'polka'
import type Queue from 'queue-promise'

import { processIncomingMessage } from '../utils/processIncomingMsg'

import { utils } from '@builderbot/bot'

import type { Message, MetaGlobalVendorArgs, IncomingMessage, ContactMeta, CallFromMeta } from '~/types'

/**
 * Class representing MetaCoreVendor, a vendor class for meta core functionality.
 * @extends EventEmitter
 */
export class MetaCoreVendor extends EventEmitter {
    queue: Queue

    /**
     * Create a MetaCoreVendor.
     * @param {Queue} _queue - The queue instance.
     */
    constructor(_queue: Queue) {
        super()
        this.queue = _queue
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
                    (status: { recipient_id: string; errors: { error_data: { details: string } }[]; status: any }) => {
                        const recipient_id = status.recipient_id || 'N/A'
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

        const contacts = body?.entry?.[0]?.changes?.[0]?.value?.contacts

        const calls = body?.entry?.[0]?.changes?.[0]?.value?.calls
        if (calls?.length) {
            await Promise.all(
                calls.map(async (call: CallFromMeta) => {
                    if (call.event === 'connect') {
                        const payload: Message = {
                            type: 'voice_call',
                            from: call.from,
                            to: call.to,
                            body: utils.generateRefProvider('_event_call_'),
                            pushName: contacts?.[0]?.profile?.name ?? 'Unknown',
                            name: contacts?.[0]?.profile?.name ?? 'Unknown',
                            message_id: call.id,
                            timestamp: call.timestamp,
                        }
                        await this.queue.enqueue(() => this.processMessage(payload))
                    }
                })
            )
            res.statusCode = 200
            res.end('Call event processed')
            return
        }

        const messages = body?.entry?.[0]?.changes?.[0]?.value?.messages
        const messageId = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id
        const messageTimestamp = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.timestamp
        if (!messages?.length) {
            res.statusCode = 200
            res.end('empty endpoint')
            return
        }

        try {
            await Promise.all(
                messages.map( async (message: any) => {
                    let contact: ContactMeta
                    if (Array.isArray(contacts)) [contact] = contacts
                    const to = body.entry[0].changes[0].value?.metadata?.display_phone_number
                    const pushName: string | undefined = contact?.profile?.name ?? 'Unknown'
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
                        jwtToken,
                        numberId,
                        version,
                        fileData,
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
