import { EventEmitterClass } from '@builderbot/bot'
import type { BotContext, ProviderEventTypes } from '@builderbot/bot/dist/types'

import { tiktokEvents } from './tiktok.events.constants'

/**
 * A single comment as returned by `GET /open_api/v1.3/business/comment/list/`.
 * Only the fields used by this provider are typed; the TikTok Business API
 * returns additional fields (e.g. `profile_image`, `liked`, `pinned`) that are
 * ignored here.
 */
export type TikTokComment = {
    comment_id: string
    text: string
    username?: string
    display_name?: string
    /** The commenter's TikTok user id. Absent on some legacy responses. */
    user_id?: string
    create_time: string
    likes?: number
    replies?: number
    status?: string
    owner?: boolean
    parent_comment_id?: string
    video_id: string
}

/** Normalized comment payload attached to BotContext for flow handlers. */
export type TikTokCommentContext = {
    id: string
    videoId: string
    parentId: string | null
    username: string
    text: string
}

export const resolveCommenterId = (comment: Pick<TikTokComment, 'user_id' | 'username' | 'comment_id'>): string =>
    comment.user_id || comment.username || comment.comment_id

export class TikTokEvents extends EventEmitterClass<ProviderEventTypes> {
    /**
     * Builds a BotContext from a raw comment discovered by the poller and
     * emits it as a 'message' event using the {@link tiktokEvents.TT_COMMENT}
     * flow token — mirrors `instagramEvents.IG_COMMENT` but is driven by
     * polling instead of a webhook, since TikTok does not push comment events.
     */
    public handleComment = (comment: TikTokComment, businessId: string): void => {
        if (!comment.comment_id) return
        if (!businessId) return

        const timestamp = (Number(comment.create_time) || 0) * 1000
        const commentCtx: TikTokCommentContext = {
            id: comment.comment_id,
            videoId: comment.video_id,
            parentId: comment.parent_comment_id || null,
            username: comment.username || '',
            text: comment.text,
        }

        const sendObj: BotContext = {
            body: tiktokEvents.TT_COMMENT,
            from: resolveCommenterId(comment),
            name: comment.display_name || comment.username || '',
            username: comment.username || '',
            host: {
                id: businessId,
                phone: 'tiktok',
            },
            timestamp,
            messageId: `comment_${comment.comment_id}`,
            comment: commentCtx,
        }

        this.emit('message', sendObj)
    }
}
