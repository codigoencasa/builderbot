import {
    useMultiFileAuthState,
    DisconnectReason,
    proto,
    makeInMemoryStore,
    makeCacheableSignalKeyStore,
    getAggregateVotesInPollMessage,
    WASocket,
    BaileysEventMap,
    AnyMediaMessageContent,
    AnyMessageContent,
    PollMessageOptions,
    downloadMediaMessage,
    WAMessage,
    MessageUpsertType,
} from '@whiskeysockets/baileys'

const makeWASocketOther = require('@whiskeysockets/baileys').default

export {
    makeWASocketOther,
    useMultiFileAuthState,
    DisconnectReason,
    proto,
    makeInMemoryStore,
    makeCacheableSignalKeyStore,
    getAggregateVotesInPollMessage,
    WASocket,
    BaileysEventMap,
    AnyMediaMessageContent,
    AnyMessageContent,
    PollMessageOptions,
    downloadMediaMessage,
    WAMessage,
    MessageUpsertType,
}
