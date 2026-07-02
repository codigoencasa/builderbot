import { utils } from '@builderbot/bot'

/**
 * Instagram-specific provider events.
 *
 * The token is computed ONCE using the `@builderbot/bot` instance linked to
 * this package. Both the provider (when emitting) and the runtime (when
 * registering flows) must import this constant — never recalculate it
 * independently — to guarantee the same token is used on both sides.
 *
 * Only meaningful when using @builderbot/provider-instagram.
 */
export const instagramEvents = {
    /** Fires when any Instagram comment is received on a post/reel. */
    IG_COMMENT: utils.setEvent('IG_COMMENT'),
} as const
