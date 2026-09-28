/**
 * LAYER: Infrastructure
 * Contains: GupshupCloudIncomingMessageArgs, GupshupCloudMessage, GupshupGlobalVendorArgs
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [GupshupCloudIncomingMessageArgs, GupshupCloudMessage, GupshupGlobalVendorArgs]
 * GOAL: Own the "process incoming msg" concern of the provider-gupshup package.
 */
import { utils } from '@builderbot/bot'
import { BotContext } from '@builderbot/bot/dist/types'

import { resolveCloudMediaId, resolveCloudMediaMeta, resolveCloudMediaUrl } from './media'
import { GupshupCloudIncomingMessageArgs, GupshupCloudMessage, GupshupGlobalVendorArgs } from '../types'

const SUPPORTED_CANONICAL_TYPES = new Set([
    'text',
    'image',
    'video',
    'audio',
    'document',
    'location',
    'button',
    'interactive',
    'contacts',
    'order',
    'reaction',
    'sticker',
])

const resolveCanonicalType = (messageType?: string): string => {
    const normalizedType = typeof messageType === 'string' ? messageType.trim().toLowerCase() : ''

    if (normalizedType && SUPPORTED_CANONICAL_TYPES.has(normalizedType)) {
        return normalizedType
    }

    return normalizedType || messageType || 'text'
}

const resolveInteractiveReply = (message: GupshupCloudMessage): string => {
    const interactiveReply =
        message.interactive?.button_reply?.title ??
        message.interactive?.button_reply?.id ??
        message.interactive?.list_reply?.id ??
        message.interactive?.list_reply?.title ??
        message.interactive?.list_reply?.description ??
        message.interactive?.nfm_reply?.response_json

    return interactiveReply ?? ''
}

const attachMediaContext = (context: BotContext, message: GupshupCloudMessage): BotContext => {
    const mediaMeta = resolveCloudMediaMeta(message)
    const mediaId = resolveCloudMediaId(message)
    const mediaUrl = resolveCloudMediaUrl(message)

    const mediaContext: BotContext = {
        ...context,
        url: mediaUrl,
    }

    if (mediaId) mediaContext.mediaId = mediaId
    if (mediaMeta.mime_type) mediaContext.mimeType = mediaMeta.mime_type
    if (mediaMeta.filename) mediaContext.filename = mediaMeta.filename
    if (mediaMeta.caption) mediaContext.caption = mediaMeta.caption
    if (mediaMeta.sha256) mediaContext.sha256 = mediaMeta.sha256
    ;(mediaContext as any).fileData = {
        ...(mediaUrl ? { url: mediaUrl } : {}),
        ...(mediaId ? { id: mediaId } : {}),
        ...(mediaMeta.mime_type ? { mime_type: mediaMeta.mime_type } : {}),
        ...(mediaMeta.filename ? { filename: mediaMeta.filename } : {}),
        ...(mediaMeta.caption ? { caption: mediaMeta.caption } : {}),
        ...(mediaMeta.sha256 ? { sha256: mediaMeta.sha256 } : {}),
    }

    return mediaContext
}

export const processIncomingMessage = async (
    raw: GupshupCloudIncomingMessageArgs,
    args: GupshupGlobalVendorArgs
): Promise<BotContext | null> => {
    const { message, contact, metadata } = raw

    if (!message || typeof message.type !== 'string' || !message.type.trim()) {
        console.log('[Gupshup] Malformed incoming message payload: missing message.type')
        return null
    }

    const from = message.from ?? contact?.wa_id

    if (!from) {
        console.log('[Gupshup] Message without sender phone')
        return null
    }

    const name = contact?.profile?.name || from

    const canonicalType = resolveCanonicalType(message.type)

    let payload: BotContext = {
        from,
        name,
        body: '',
        url: '',
        ...(message.id ? ({ id: message.id, message_id: message.id } as Record<string, unknown>) : {}),
        ...(message.timestamp ? ({ timestamp: message.timestamp } as Record<string, unknown>) : {}),
        type: canonicalType,
        host: {
            phone: metadata?.display_phone_number ?? args.phoneNumber,
        },
    }

    switch (canonicalType) {
        case 'text':
            payload.body = message.text?.body ?? ''
            break

        case 'image':
        case 'video':
        case 'sticker':
            payload.body = utils.generateRefProvider('_event_media_')
            payload = attachMediaContext(payload, message)
            break

        case 'document':
            payload.body = utils.generateRefProvider('_event_document_')
            payload = attachMediaContext(payload, message)
            break

        case 'audio':
            payload.body = utils.generateRefProvider('_event_voice_note_')
            payload = attachMediaContext(payload, message)
            break

        case 'location':
            payload.body = utils.generateRefProvider('_event_location_')
            payload.latitude = message.location?.latitude
            payload.longitude = message.location?.longitude
            payload.locationName = message.location?.name
            payload.locationAddress = message.location?.address
            break

        case 'button':
            payload.body = message.button?.payload ?? message.button?.text ?? ''
            payload.buttonPayload = message.button?.payload
            ;(payload as any).payload = message.button?.payload
            ;(payload as any).title_button_reply = message.button?.payload ?? message.button?.text ?? ''
            break

        case 'interactive':
            payload.body = resolveInteractiveReply(message)
            payload.interactiveId = message.interactive?.button_reply?.id ?? message.interactive?.list_reply?.id
            ;(payload as any).title_button_reply = message.interactive?.button_reply?.title
            ;(payload as any).title_list_reply = message.interactive?.list_reply?.title
            ;(payload as any).id_list_reply = message.interactive?.list_reply?.id

            if (message.interactive?.nfm_reply?.response_json) {
                const responseJson = message.interactive.nfm_reply.response_json

                if (!payload.body) {
                    payload.body = responseJson
                }

                ;(payload as any).message = {
                    interactive: message.interactive,
                }

                try {
                    ;(payload as any).nfm_reply = JSON.parse(responseJson)
                } catch {
                    ;(payload as any).nfm_reply = undefined
                }
            }
            break

        case 'contacts':
            payload.body = utils.generateRefProvider('_event_contacts_')
            payload.contacts = message.contacts ?? []
            break

        case 'order':
            payload.body = utils.generateRefProvider('_event_order_')
            payload.order = message.order
            break

        case 'reaction':
            payload.body = message.reaction?.emoji ?? utils.generateRefProvider('_event_reaction_removed_')
            payload.reactionToMessageId = message.reaction?.message_id
            ;(payload as any).reactionEmoji = message.reaction?.emoji ?? ''
            break

        default:
            console.log(`[Gupshup] Unhandled message type: ${canonicalType}`)
            return null
    }

    if (!payload.body) {
        console.log(`[Gupshup] Empty body for message type: ${message.type}`)
        return null
    }

    return payload
}
