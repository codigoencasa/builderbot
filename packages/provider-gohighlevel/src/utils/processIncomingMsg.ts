import { utils } from '@builderbot/bot'
import mime from 'mime-types'

import { parseGHLNumber } from './number'

import type { GHLAttachment, GHLMessage, GHLIncomingWebhook } from '~/types'

/**
 * GHL's InboundMessage webhook sends `attachments` as an array of plain URL
 * strings (not `{ url, type }` objects). Normalize both shapes so downstream
 * code can always read `.url` / `.type`.
 */
const normalizeAttachments = (raw: GHLIncomingWebhook['attachments']): GHLAttachment[] => {
    if (!raw) return []
    return raw.map((att) => (typeof att === 'string' ? { url: att } : att))
}

/**
 * Resolves the attachment's mime type, falling back to guessing from the
 * URL's file extension when GHL doesn't include a `type` field.
 */
const resolveAttachmentType = (attachment: GHLAttachment): string => {
    if (attachment.type) return attachment.type.toLowerCase()
    const guessed = mime.lookup(attachment.url.split('?')[0])
    return guessed ? guessed.toLowerCase() : ''
}

export const processIncomingMessage = (webhook: GHLIncomingWebhook): GHLMessage | null => {
    if (!webhook || webhook.direction !== 'inbound') return null

    const phone = parseGHLNumber(webhook.phone ?? '')
    // PRIORITY: Use contactId when available (more reliable than phone which can be partial/invalid)
    const from = webhook.contactId || phone || ''
    const name = webhook.contactId ?? phone

    const attachments = normalizeAttachments(webhook.attachments)
    const hasAttachments = attachments.length > 0

    let body = webhook.body ?? ''
    let type = 'text'
    let url: string | undefined

    if (hasAttachments) {
        const attachment = attachments[0]
        const attachmentType = resolveAttachmentType(attachment)

        if (attachmentType.includes('image')) {
            type = 'image'
            body = body || utils.generateRefProvider('_event_media_')
            url = attachment.url
        } else if (attachmentType.includes('video')) {
            type = 'video'
            body = body || utils.generateRefProvider('_event_media_')
            url = attachment.url
        } else if (attachmentType.includes('audio')) {
            type = 'audio'
            body = body || utils.generateRefProvider('_event_voice_note_')
            url = attachment.url
        } else {
            type = 'document'
            body = body || utils.generateRefProvider('_event_document_')
            url = attachment.url
        }
    }

    const timestamp = webhook.dateAdded ? new Date(webhook.dateAdded).getTime() : Date.now()

    const message: GHLMessage = {
        type,
        from,
        to: webhook.locationId ?? '',
        body,
        name,
        pushName: name,
        message_id: webhook.messageId,
        timestamp: isNaN(timestamp) ? Date.now() : timestamp,
        contactId: webhook.contactId,
        conversationId: webhook.conversationId,
        channelType: webhook.messageType as GHLMessage['channelType'],
        direction: webhook.direction,
    }

    if (url) message.url = url
    if (hasAttachments) message.attachments = attachments

    return message
}
