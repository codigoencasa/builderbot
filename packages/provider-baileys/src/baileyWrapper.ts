/**
 * LAYER: Infrastructure
 * Contains: BaileyWrapper
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [BaileyWrapper]
 * GOAL: Own the "bailey wrapper" concern of the provider-baileys package.
 */
import makeWASocketOther, {
    useMultiFileAuthState,
    DisconnectReason,
    proto,
    makeCacheableSignalKeyStore,
    getAggregateVotesInPollMessage,
    Browsers,
    downloadMediaMessage,
    fetchLatestBaileysVersion,
    fetchLatestWaWebVersion,
    isJidGroup,
    isJidBroadcast,
    isLidUser,
} from 'baileys'
import type {
    WASocket,
    BaileysEventMap,
    AnyMediaMessageContent,
    AnyMessageContent,
    WAMessage,
    MessageUpsertType,
    PollMessageOptions,
    WAVersion,
    WABrowserDescription,
} from 'baileys'

export {
    makeWASocketOther,
    useMultiFileAuthState,
    DisconnectReason,
    proto,
    makeCacheableSignalKeyStore,
    getAggregateVotesInPollMessage,
    Browsers,
    downloadMediaMessage,
    fetchLatestBaileysVersion,
    fetchLatestWaWebVersion,
    isJidGroup,
    isJidBroadcast,
    isLidUser,
}

export type {
    WASocket,
    BaileysEventMap,
    AnyMediaMessageContent,
    AnyMessageContent,
    WAMessage,
    MessageUpsertType,
    PollMessageOptions,
    WAVersion,
    WABrowserDescription,
}
