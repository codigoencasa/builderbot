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
    WASocket,
    BaileysEventMap,
    Browsers,
    AnyMediaMessageContent,
    AnyMessageContent,
    downloadMediaMessage,
    fetchLatestBaileysVersion,
    fetchLatestWaWebVersion,
    WAMessage,
    MessageUpsertType,
    isJidGroup,
    isJidBroadcast,
    isLidUser,
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
    WASocket,
    BaileysEventMap,
    Browsers,
    AnyMediaMessageContent,
    AnyMessageContent,
    downloadMediaMessage,
    fetchLatestBaileysVersion,
    fetchLatestWaWebVersion,
    WAMessage,
    MessageUpsertType,
    isJidGroup,
    isJidBroadcast,
    isLidUser,
    PollMessageOptions,
    WAVersion,
    WABrowserDescription,
}
