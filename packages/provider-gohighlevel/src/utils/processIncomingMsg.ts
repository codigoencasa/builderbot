import { utils } from '@builderbot/bot'

import { parseGHLNumber } from './number'
import type { GHLMessage, GHLIncomingWebhook } from '~/types'

export const processIncomingMessage = (webhook: GHLIncomingWebhook): GHLMessage | null => {
    if (!webhook || webhook.direction !== 'inbound') return null

    const phone = parseGHLNumber(webhook.phone ?? '')
    const name = webhook.contactId ?? phone
    const hasAttachments = webhook.attachments && webhook.attachments.length > 0

    let body = webhook.body ?? ''
    let type = 'text'
    let url: string | undefined

    if (hasAttachments) {
        const attachment = webhook.attachments[0]
        const attachmentType = attachment.type?.toLowerCase() ?? ''

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
        from: phone,
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
    if (hasAttachments) message.attachments = webhook.attachments

    return message
}
