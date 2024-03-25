import { utils } from '@builderbot/bot'
import mime from 'mime-types'
import EventEmitter from 'node:events'
import { existsSync, createReadStream } from 'node:fs'
import type polka from 'polka'
import twilio from 'twilio'

import type { ITwilioProviderARgs, TwilioPayload, TwilioRequestBody } from '../types'
import { parseNumber } from '../utils'

/**
 * Class representing TwilioCoreVendor, a vendor class for meta core functionality.
 * @extends EventEmitter
 */
export class TwilioCoreVendor extends EventEmitter {
    public twilio: twilio.Twilio

    constructor(globalVendorArgs: ITwilioProviderARgs) {
        super()
        this.twilio = twilio(globalVendorArgs.accountSid, globalVendorArgs.authToken)
        const host = {
            phone: parseNumber(globalVendorArgs.vendorNumber),
        }
        this.emit('host', host)
    }

    /**
     * Middleware function for indexing home.
     * @type {polka.Middleware}
     */
    public indexHome: polka.Middleware = (_, res) => {
        res.end('running ok')
    }
    /**
     * Middleware function for handling incoming messages.
     * @type {polka.Middleware}
     */
    public incomingMsg: polka.Middleware = (req, res) => {
        const body = req.body as TwilioRequestBody
        const payload: TwilioPayload = {
            ...req.body,
            from: parseNumber(body.From),
            to: parseNumber(body.To),
            host: parseNumber(body.To),
            body: body.Body,
            name: `${body?.ProfileName}`,
        }

        if (body?.NumMedia !== '0' && body?.MediaContentType0) {
            const type = body?.MediaContentType0.split('/')[0]
            switch (type) {
                case 'audio':
                    payload.body = utils.generateRefProvider('_event_voice_note_')
                    break
                case 'image':
                case 'video':
                    payload.body = utils.generateRefProvider('_event_media_')
                    break
                case 'application':
                    payload.body = utils.generateRefProvider('_event_document_')
                    break
                case 'text':
                    payload.body = utils.generateRefProvider('_event_contacts_')
                    break
                default:
                    break
            }
        } else {
            if (body.Latitude && body.Longitude) {
                payload.body = utils.generateRefProvider('_event_location_')
            }
        }

        this.emit('message', payload)
        const jsonResponse = JSON.stringify({ body })
        res.end(jsonResponse)
    }

    /**
     * Manejar los local media como
     * C:\\Projects\\bot-restaurante\\tmp\\menu.png
     * para que puedas ser llevar a una url online
     * @param req
     * @param res
     */
    public handlerLocalMedia: polka.Middleware = (req, res) => {
        const query = req.query as { path?: string }
        const file = query?.path
        if (!file) return res.end(`path: invalid`)
        const decryptPath = utils.decryptData(file)
        const decodeFile = decodeURIComponent(decryptPath)
        if (!existsSync(decodeFile)) return res.end(`not exits: ${decodeFile}`)
        const fileStream = createReadStream(decodeFile)
        const mimeType = mime.lookup(decodeFile) || 'application/octet-stream'
        res.writeHead(200, { 'Content-Type': mimeType })
        fileStream.pipe(res)
    }
}
