import { utils } from '@builderbot/bot'

/**
 * TikTok-specific provider events.
 *
 * The token is computed ONCE using the `@builderbot/bot` instance linked to
 * this package. Both the provider (when emitting) and the runtime (when
 * registering flows) must import this constant — never recalculate it
 * independently — to guarantee the same token is used on both sides.
 *
 * Only meaningful when using @builderbot/provider-tiktok.
 */
export const tiktokEvents = {
    /**
     * Fires when a new comment is detected on a watched TikTok video.
     *
     * Unlike Instagram, TikTok does not push a webhook for organic comments —
     * this event is emitted by the internal poller once it diffs a
     * `GET /business/comment/list/` response against previously seen
     * comment_ids. See {@link ../README.md} for the polling design.
     */
    TT_COMMENT: utils.setEvent('TT_COMMENT'),
} as const
