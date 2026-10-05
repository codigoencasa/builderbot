/**
 * LAYER: Infrastructure
 * Contains: BaileyWrapper
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [BaileyWrapper]
 * GOAL: Own the "bailey wrapper" concern of the provider-baileys package.
 */
import makeWASocketDefault, {
    makeWASocket as makeWASocketNamed,
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

/**
 * Baileys ships ESM-only. In the CommonJS bundle `require('baileys')` returns the
 * module namespace, and Rollup's interop rewrites the default import to that same
 * namespace object — which is not callable. Prefer the stable named export
 * (`makeWASocket`) and fall back to a callable default when available.
 */
const makeWASocketOther = (
    typeof makeWASocketNamed === 'function' ? makeWASocketNamed : makeWASocketDefault
) as typeof makeWASocketNamed

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
