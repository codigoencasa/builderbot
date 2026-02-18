import { EventEmitterClass, utils } from '@builderbot/bot'
import { ProviderEventTypes } from '@builderbot/bot/dist/types'

export type InstagramMessage = {
    object: string
    entry: Array<{
        time: number
        id: string
        messaging: Array<{
            sender: { id: string }
            recipient: { id: string }
            timestamp: number
            message?: {
                is_echo?: boolean
                is_self?: boolean
                mid?: string
                text?: string
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

export class InstagramEvents extends EventEmitterClass<ProviderEventTypes> {
    /**
     * Function that handles incoming Instagram message events.
     * @param payload - The incoming Instagram message payload.
     */
    public eventInMsg = (payload: InstagramMessage) => {
        if (payload.object !== 'instagram' || !payload.entry || payload.entry.length === 0) return

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

    private handleMessage = (messagingEvent: InstagramMessage['entry'][0]['messaging'][0]) => {
        if (!messagingEvent.message) return

        const isEcho = messagingEvent.message?.is_echo || messagingEvent.message?.is_self
        if (isEcho) return

        const sendObj = {
            body: messagingEvent.message?.text || '',
            from: messagingEvent.sender.id,
            name: '',
            host: {
                id: messagingEvent.recipient.id,
                phone: 'instagram',
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
            }
        }

        this.emit('message', sendObj)
    }

    private handlePostback = (messagingEvent: InstagramMessage['entry'][0]['messaging'][0]) => {
        if (!messagingEvent.postback) return

        const sendObj = {
            body: messagingEvent.postback.payload,
            from: messagingEvent.sender.id,
            name: '',
            host: {
                id: messagingEvent.recipient.id,
                phone: 'instagram',
            },
            timestamp: messagingEvent.timestamp,
            messageId: `postback_${messagingEvent.timestamp}`,
        }

        this.emit('message', sendObj)
    }
}
