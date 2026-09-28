/**
 * LAYER: Infrastructure
 * Contains: EvolutionCoreVendor, EvolutionGlobalVendorArgs
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [EvolutionCoreVendor, EvolutionGlobalVendorArgs]
 * GOAL: Own the "core" concern of the provider-evolution-api package.
 */
import { randomUUID } from 'node:crypto'
import EventEmitter from 'node:events'
import type polka from 'polka'
import type Queue from 'queue-promise'

import type { EvolutionGlobalVendorArgs } from '../types'

/**
 * Genera un UUID único con un prefijo opcional.
 * @param prefix - Prefijo opcional para el UUID.
 * @returns Un identificador único (UUID v4).
 */
const generateRefProvider = (prefix?: string): string => {
    const id = randomUUID()
    return prefix ? `${prefix}_${id}` : id
}

/**
 * Elimina el dominio del JID de WhatsApp (e.g., "@s.whatsapp.net").
 * @param jid - JID completo.
 * @returns El número limpio.
 */
const cleanJid = (jid: string): string => {
    return jid?.split('@')[0] ?? ''
}

type RawMessage = Record<string, any>
type IncomingEvent = 'messages.upsert' | 'connection.update' | 'qrcode.updated' | 'logout.instance' | 'send.message'

/**
 * Class representing EvolutionCoreVendor, a vendor class for WhatsApp Business API integration.
 * Handles webhook validation, message reception, and processing through Meta's Cloud API.
 * @extends EventEmitter
 */
export class EvolutionCoreVendor extends EventEmitter {
    /**
     * Queue for handling asynchronous message processing
     * @private
     */
    private readonly queue: Queue

    /**
     * Creates an instance of EvolutionCoreVendor.
     * @param {Queue} _queue - The queue instance for managing message processing.
     */
    constructor(_queue: Queue) {
        super()
        if (!_queue) {
            throw new Error('Queue instance is required')
        }
        this.queue = _queue
    }

    /**
     * Middleware function for health check endpoint.
     * Returns a simple response to verify the service is running.
     * @type {polka.Middleware}
     */
    public indexHome: polka.Middleware = (_, res) => {
        try {
            res.end('ok')
        } catch (error) {
            console.error('Error in indexHome middleware:', error)
            res.statusCode = 500
            res.end('Internal server error')
        }
    }

    /**
     * Middleware function for handling incoming webhook messages.
     * Processes incoming messages from WhatsApp and adds them to the processing queue.
     * @type {polka.Middleware}
     */
    public incomingMsg: polka.Middleware = async (req: any, res: any) => {
        try {
            const globalVendorArgs: EvolutionGlobalVendorArgs = req['globalVendorArgs'] ?? null
            if (!globalVendorArgs) {
                res.statusCode = 400
                res.end('Missing vendor arguments')
                return
            }

            const { event, data }: { event: IncomingEvent; data: RawMessage } = req.body

            if (!req.body) {
                res.statusCode = 400
                res.end('Invalid request body')
                return
            }

            switch (event) {
                case 'messages.upsert':
                    if (data.message) {
                        const { message } = data
                        const from = cleanJid(data.key?.remoteJid)
                        const name = data.pushName
                        let responseObj: Record<string, any> | null = null

                        if (message.documentMessage) {
                            responseObj = {
                                type: data.messageType,
                                from,
                                mimetype: message.documentMessage.mimetype,
                                body: generateRefProvider('_event_document_'),
                                name,
                                caption: message.documentMessage.caption,
                                base64: message.base64,
                            }
                        } else if (message.orderMessage) {
                            responseObj = {
                                from,
                                name,
                                body: generateRefProvider('_event_order_'),
                            }
                        } else if (message.videoMessage) {
                            responseObj = {
                                type: data.messageType,
                                from,
                                mimetype: message.videoMessage.mimetype,
                                body: generateRefProvider('_event_media_'),
                                name,
                                caption: message.videoMessage.caption || '',
                                base64: message.base64,
                            }
                        } else if (message.imageMessage) {
                            responseObj = {
                                type: data.messageType,
                                from,
                                mimetype: message.imageMessage.mimetype,
                                body: generateRefProvider('_event_media_'),
                                name,
                                caption: message.imageMessage.caption || '',
                                base64: message.base64,
                            }
                        } else if (message.audioMessage) {
                            responseObj = {
                                type: data.messageType,
                                from,
                                mimetype: message.audioMessage.mimetype,
                                body: generateRefProvider('_event_voice_note_'),
                                name,
                                caption: message.audioMessage.caption || '',
                                base64: message.base64,
                            }
                        } else if (message.locationMessage || message.liveLocationMessage) {
                            responseObj = {
                                type: data.messageType,
                                from,
                                latitude:
                                    message.locationMessage?.degreesLatitude ??
                                    message.liveLocationMessage?.degreesLatitude,
                                longitude:
                                    message.locationMessage?.degreesLongitude ??
                                    message.liveLocationMessage?.degreesLongitude,
                                body: generateRefProvider('_event_location_'),
                                name,
                            }
                        } else if (message.conversation) {
                            responseObj = {
                                type: data.messageType,
                                from,
                                body: message.conversation,
                                name,
                            }
                        }

                        if (responseObj) {
                            const enrichedMessage = { ...data, ...responseObj }

                            await this.queue.enqueue(() => this.processMessage(enrichedMessage))
                        }
                    }
            }
            res.statusCode = 200
            res.end('Message processed successfully')

            // Check for errors reported by Meta
        } catch (error) {
            console.error('Error processing incoming message:', error)
            this.emit('notice', {
                title: '🔔  EVOLUTION API ALERT  🔔',
                instructions: [error.message || 'An error occurred while processing message.'],
            })
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(
                JSON.stringify({
                    error: error.message || 'An error occurred while processing message.',
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                })
            )
        }
    }

    /**
     * Procesa un mensaje entrante y lo emite al flujo del bot.
     * @param message - Objeto de mensaje enriquecido.
     */
    public processMessage = (message: any): Promise<void> => {
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
