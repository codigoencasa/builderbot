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
