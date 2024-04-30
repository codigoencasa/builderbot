import { utils } from '@builderbot/bot'

import { getMediaUrl } from './mediaUrl'
import type { Message, ParamsIncomingMessage as ParamsIncomingMessage } from '../types'

export const processIncomingMessage = async ({
    messageId,
    messageTimestamp,
    pushName,
    message,
    to,
    jwtToken,
    version,
    numberId,
}: ParamsIncomingMessage): Promise<Message> => {
    let responseObj: Message

    switch (message.type) {
        case 'text': {
            responseObj = {
                type: message.type,
                from: message.from,
                to,
                body: message.text?.body,
                name: pushName,
                pushName,
            }
            break
        }
        case 'interactive': {
            responseObj = {
                type: 'interactive',
                from: message.from,
                to,
                body:
                    message.interactive?.button_reply?.title ??
                    message.interactive?.list_reply?.id ??
                    message.interactive?.nfm_reply,
                title_button_reply: message.interactive?.button_reply?.title,
                title_list_reply: message.interactive?.list_reply?.title,
                pushName,
                name: pushName,
            }
            break
        }
        case 'button': {
            responseObj = {
                type: 'button',
                from: message.from,
                to,
                body: message.button?.text,
                payload: message.button?.payload,
                title_button_reply: message.button?.payload,
                pushName,
                name: pushName,
            }
            break
        }
        case 'image': {
            const imageUrl = await getMediaUrl(version, message.image?.id, numberId, jwtToken)
            responseObj = {
                type: message.type,
                from: message.from,
                url: imageUrl,
                caption: message?.image?.caption,
                to,
                body: utils.generateRefProvider('_event_media_'),
                pushName,
                name: pushName,
            }
            break
        }
        case 'document': {
            const documentUrl = await getMediaUrl(version, message.document?.id, numberId, jwtToken)
            responseObj = {
                type: message.type,
                from: message.from,
                url: documentUrl,
                to,
                body: utils.generateRefProvider('_event_document_'),
                pushName,
                name: pushName,
            }
            break
        }
        case 'video': {
            const videoUrl = await getMediaUrl(version, message.video?.id, numberId, jwtToken)
            responseObj = {
                type: message.type,
                from: message.from,
                url: videoUrl,
                caption: message?.video?.caption,
                to,
                body: utils.generateRefProvider('_event_media_'),
                pushName,
                name: pushName,
            }
            break
        }
        case 'location': {
            responseObj = {
                type: message.type,
                from: message.from,
                to,
                latitude: message.location.latitude,
                longitude: message.location.longitude,
                body: utils.generateRefProvider('_event_location_'),
                pushName,
                name: pushName,
            }
            break
        }
        case 'audio': {
            const audioUrl = await getMediaUrl(version, message.audio?.id, numberId, jwtToken)
            responseObj = {
                type: message.type,
                from: message.from,
                url: audioUrl,
                to,
                body: utils.generateRefProvider('_event_voice_note_'),
                pushName,
                name: pushName,
            }
            break
        }
        case 'sticker': {
            responseObj = {
                type: message.type,
                from: message.from,
                to,
                id: message.sticker.id,
                body: utils.generateRefProvider('_event_media_'),
                pushName,
                name: pushName,
            }
            break
        }
        case 'contacts': {
            responseObj = {
                type: message.type,
                from: message.from,
                contacts: [
                    {
                        name: message.contacts[0].name,
                        phones: message.contacts[0].phones,
                    },
                ] as any,
                to,
                body: utils.generateRefProvider('_event_contacts_'),
                pushName,
                name: pushName,
            }
            break
        }
        case 'order': {
            responseObj = {
                type: message.type,
                from: message.from,
                to,
                order: {
                    catalog_id: message.order.catalog_id,
                    product_items: message.order.product_items,
                },
                body: utils.generateRefProvider('_event_order_'),
                pushName,
                name: pushName,
            }
            break
        }
        default:
            // Lógica para manejar tipos de mensajes no reconocidos
            break
    }
    return {
        ...responseObj,
        message_id: messageId,
        timestamp: messageTimestamp,
    }
}
