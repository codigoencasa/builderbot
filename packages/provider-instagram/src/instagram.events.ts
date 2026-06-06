import { EventEmitterClass, utils } from '@builderbot/bot'
import { ProviderEventTypes } from '@builderbot/bot/dist/types'

export type InstagramListenMode = 'message' | 'comment' | 'both'

export type InstagramCommentValue = {
    from: {
        id: string
        username?: string
    }
    media: {
        id: string
        media_product_type?: string
    }
    id: string
    parent_id?: string
    text: string
    timestamp: string
}

export type InstagramMessage = {
    object: string
    entry: Array<{
        time: number
        id: string
        messaging?: Array<{
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
        changes?: Array<{
            field: string
            value: InstagramCommentValue
        }>
    }>
}

export class InstagramEvents extends EventEmitterClass<ProviderEventTypes> {
    private listenMode: InstagramListenMode = 'message'

    setListenMode(mode: InstagramListenMode): void {
        this.listenMode = mode
    }

    /**
     * Function that handles incoming Instagram message events.
     * @param payload - The incoming Instagram message payload.
     */
    public eventInMsg = (payload: InstagramMessage) => {
        if (payload.object !== 'instagram' || !payload.entry || payload.entry.length === 0) return

        payload.entry.forEach((entry) => {
            if (entry.messaging && (this.listenMode === 'message' || this.listenMode === 'both')) {
                entry.messaging.forEach((messagingEvent) => {
                    if (messagingEvent.message) {
                        this.handleMessage(messagingEvent)
                    } else if (messagingEvent.postback) {
                        this.handlePostback(messagingEvent)
                    }
                })
            }

            if (entry.changes && (this.listenMode === 'comment' || this.listenMode === 'both')) {
                entry.changes.forEach((change) => {
                    if (change.field === 'comments') {
                        this.handleComment(change.value, entry.id)
                    }
                })
            }
        })
    }

    private handleMessage = (messagingEvent: NonNullable<InstagramMessage['entry'][0]['messaging']>[0]) => {
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
        } as {
            body: string
            from: string
            name: string
            host: { id: string; phone: string }
            timestamp: number
            messageId: string
            data?: { media: { url: string } }
        }

        if (messagingEvent.message?.attachments && messagingEvent.message.attachments.length > 0) {
            const attachment = messagingEvent.message.attachments[0]
            sendObj.data = { media: { url: attachment.payload.url } }
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

    private handlePostback = (messagingEvent: NonNullable<InstagramMessage['entry'][0]['messaging']>[0]) => {
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

    private handleComment = (commentValue: InstagramCommentValue, pageId: string) => {
        const timestamp = new Date(commentValue.timestamp).getTime() || Date.now()

        const sendObj = {
            body: commentValue.text,
            from: commentValue.from.id,
            name: commentValue.from.username || '',
            host: {
                id: pageId,
                phone: 'instagram',
            },
            timestamp,
            messageId: `comment_${commentValue.id}`,
            comment: {
                id: commentValue.id,
                parentId: commentValue.parent_id || null,
                mediaId: commentValue.media.id,
                username: commentValue.from.username || '',
            },
        }

        this.emit('message', sendObj)
    }
}
