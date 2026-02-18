import { EventEmitterClass, utils } from '@builderbot/bot'
import { ProviderEventTypes } from '@builderbot/bot/dist/types'

export type MessengerMessage = {
    object: string
    entry: Array<{
        id: string
        time: number
        messaging: Array<{
            sender: { id: string }
            recipient: { id: string }
            timestamp: number
            message?: {
                mid: string
                text?: string
                is_echo?: boolean
                attachments?: Array<{
                    type: string
                    payload: {
                        url: string
                    }
                }>
            }
            postback?: {
                title: string
                payload: string
            }
        }>
    }>
}

export class MessengerEvents extends EventEmitterClass<ProviderEventTypes> {
    /**
     * Function that handles incoming Facebook Messenger message events.
     * @param payload - The incoming Messenger message payload.
     */
    public eventInMsg = (payload: MessengerMessage) => {
        if (payload.object !== 'page' || !payload.entry || payload.entry.length === 0) return

        payload.entry.forEach((entry) => {
            entry.messaging.forEach((messagingEvent) => {
                if (messagingEvent.message) {
                    this.handleMessage(messagingEvent)
                } else if (messagingEvent.postback) {
                    this.handlePostback(messagingEvent)
                }
            })
        })
    }

    private handleMessage = (messagingEvent: MessengerMessage['entry'][0]['messaging'][0]) => {
        if (!messagingEvent.message) return
        if (messagingEvent.message?.is_echo) return

        const sendObj = {
            body: messagingEvent.message?.text || '',
            from: messagingEvent.sender.id,
            name: '',
            host: {
                id: messagingEvent.recipient.id,
                phone: 'messenger',
            },
            timestamp: messagingEvent.timestamp,
            messageId: messagingEvent.message?.mid || '',
        }

        if (messagingEvent.message?.attachments && messagingEvent.message.attachments.length > 0) {
            const attachment = messagingEvent.message.attachments[0]
            switch (attachment.type) {
                case 'image':
                    sendObj.body = utils.generateRefProvider('_event_media_')
                    break
                case 'video':
                    sendObj.body = utils.generateRefProvider('_event_media_')
                    break
                case 'audio':
                    sendObj.body = utils.generateRefProvider('_event_voice_note_')
                    break
                case 'file':
                    sendObj.body = utils.generateRefProvider('_event_document_')
                    break
                case 'location':
                    sendObj.body = utils.generateRefProvider('_event_location_')
                    break
            }
        }

        this.emit('message', sendObj)
    }

    private handlePostback = (messagingEvent: MessengerMessage['entry'][0]['messaging'][0]) => {
        if (!messagingEvent.postback) return

        const sendObj = {
            body: messagingEvent.postback.payload,
            from: messagingEvent.sender.id,
            name: '',
            host: {
                id: messagingEvent.recipient.id,
                phone: 'messenger',
            },
            timestamp: messagingEvent.timestamp,
            messageId: `postback_${messagingEvent.timestamp}`,
        }

        this.emit('message', sendObj)
    }
}
