/**
 * LAYER: Infrastructure
 * Contains: SherpaWrapper, WALogger
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [SherpaWrapper, WALogger]
 * GOAL: Own the "sherpa wrapper" concern of the provider-sherpa package.
 */
import makeWASocketOther, {
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    getAggregateVotesInPollMessage,
    WASocket,
    BaileysEventMap,
    AnyMediaMessageContent,
    AnyMessageContent,
    downloadMediaMessage,
    WAMessage,
    MessageUpsertType,
    isJidGroup,
    isJidBroadcast,
    SocketConfig,
} from 'whaileys'
import { proto } from 'whaileys/WAProto'

export type WALogger = SocketConfig['logger']
export {
    makeWASocketOther,
    useMultiFileAuthState,
    DisconnectReason,
    proto,
    makeCacheableSignalKeyStore,
    getAggregateVotesInPollMessage,
    WASocket,
    BaileysEventMap,
    AnyMediaMessageContent,
    AnyMessageContent,
    downloadMediaMessage,
    WAMessage,
    MessageUpsertType,
    isJidGroup,
    isJidBroadcast,
}
