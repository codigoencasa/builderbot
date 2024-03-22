import EventEmitter from 'node:events'
import type polka from 'polka'
import type Queue from 'queue-promise'

import type { Message, MetaGlobalVendorArgs } from '../types'
import { processIncomingMessage } from '../utils/processIncomingMsg'

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
        if (this.tokenIsValid(mode, token, globalVendorArgs.verifyToken)) {
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
        const { body } = req
        const { jwtToken, numberId, version } = globalVendorArgs
        const messages = body?.entry?.[0]?.changes?.[0]?.value?.messages
        const contacts = req?.body?.entry?.[0]?.changes?.[0]?.value?.contacts
        if (!messages?.length) {
            res.statusCode = 200
            res.end('empty endpoint')
            return
        }

        messages.forEach(async (message: any) => {
            const [contact] = contacts
            const to = body.entry[0].changes[0].value?.metadata?.display_phone_number
            const pushName = contact?.profile?.name
            const response: Message = await processIncomingMessage({
                to,
                pushName,
                message,
                jwtToken,
                numberId,
                version,
            })
            if (response) {
                this.queue.enqueue(() => this.processMessage(response))
            }
        })

        res.statusCode = 200
        res.end('Messages enqueued')
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
