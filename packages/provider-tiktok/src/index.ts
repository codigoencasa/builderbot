/**
 * LAYER: Infrastructure
 * Contains: TikTokArgs, TikTokComment
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [TikTokArgs, TikTokComment]
 * GOAL: Own the "src" concern of the provider-tiktok package.
 */
export { TikTokProvider, LruSet, type TikTokArgs, type TikTokVideoConfig } from './tiktok.provider'
export { TikTokEvents, type TikTokComment, type TikTokCommentContext, resolveCommenterId } from './tiktok.events'
export { tiktokEvents } from './tiktok.events.constants'
