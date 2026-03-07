import { EventEmitterClass, utils } from '@builderbot/bot'
import { ProviderEventTypes } from '@builderbot/bot/dist/types'

export type TwitterDMEvent = {
    for_user_id: string
    direct_message_events: Array<{
        type: string
        id: string
        created_timestamp: string
        message_create: {
            target: { recipient_id: string }
            sender_id: string
            source_app_id?: string
            message_data: {
                text: string
                attachment?: {
                    type: string
                    media?: {
                        id_str: string
                        media_url_https: string
                        type: string
                    }
                }
            }
        }
    }>
    users: Record<
        string,
        {
            id_str: string
            name: string
            screen_name: string
            profile_image_url_https?: string
        }
    >
}

export type TwitterMentionEvent = {
    for_user_id: string
    tweet_create_events: Array<{
        id_str: string
        created_at: string
        text: string
        full_text?: string
        user: {
            id_str: string
            name: string
            screen_name: string
        }
        in_reply_to_user_id_str?: string
        in_reply_to_status_id_str?: string
        extended_entities?: {
            media?: Array<{
                media_url_https: string
                type: string
            }>
        }
    }>
}

export class TwitterEvents extends EventEmitterClass<ProviderEventTypes> {
    /**
     * Handles incoming Twitter webhook payloads (DMs and mentions).
     * @param payload - The raw webhook payload from Twitter
     */
    public eventInMsg = (payload: any) => {
        if (payload.direct_message_events?.length) {
            this.handleDirectMessages(payload as TwitterDMEvent)
        }

        if (payload.tweet_create_events?.length) {
            this.handleMentions(payload as TwitterMentionEvent)
        }
    }

    private handleDirectMessages = (payload: TwitterDMEvent) => {
        const botUserId = payload.for_user_id

        payload.direct_message_events.forEach((event) => {
            if (event.type !== 'message_create') return

            const senderId = event.message_create.sender_id
            if (senderId === botUserId) return

            const senderUser = payload.users?.[senderId]
            const msgData = event.message_create.message_data

            let body = msgData.text || ''

            if (msgData.attachment?.media) {
                const mediaType = msgData.attachment.media.type
                if (mediaType === 'photo') {
                    body = utils.generateRefProvider('_event_media_')
                } else if (mediaType === 'video' || mediaType === 'animated_gif') {
                    body = utils.generateRefProvider('_event_media_')
                }
            }

            const sendObj: any = {
                body,
                from: senderId,
                name: senderUser?.screen_name || senderUser?.name || senderId,
                host: {
                    id: botUserId,
                    phone: 'twitter',
                },
                timestamp: parseInt(event.created_timestamp),
                messageId: event.id,
            }

            if (msgData.attachment?.media) {
                sendObj.data = {
                    media: {
                        url: msgData.attachment.media.media_url_https,
                        type: msgData.attachment.media.type,
                    },
                }
            }

            this.emit('message', sendObj)
        })
    }

    private handleMentions = (payload: TwitterMentionEvent) => {
        const botUserId = payload.for_user_id

        payload.tweet_create_events.forEach((tweet) => {
            if (tweet.user.id_str === botUserId) return

            const text = tweet.full_text || tweet.text
            let body = text

            if (tweet.extended_entities?.media?.length) {
                const mediaType = tweet.extended_entities.media[0].type
                if (mediaType === 'photo') {
                    body = utils.generateRefProvider('_event_media_')
                } else if (mediaType === 'video' || mediaType === 'animated_gif') {
                    body = utils.generateRefProvider('_event_media_')
                }
            }

            const sendObj: any = {
                body,
                from: tweet.user.id_str,
                name: tweet.user.screen_name,
                host: {
                    id: botUserId,
                    phone: 'twitter',
                },
                timestamp: new Date(tweet.created_at).getTime(),
                messageId: tweet.id_str,
                data: {
                    tweetId: tweet.id_str,
                    isReply: !!tweet.in_reply_to_status_id_str,
                },
            }

            if (tweet.extended_entities?.media?.length) {
                sendObj.data.media = {
                    url: tweet.extended_entities.media[0].media_url_https,
                    type: tweet.extended_entities.media[0].type,
                }
            }

            this.emit('message', sendObj)
        })
    }
}
