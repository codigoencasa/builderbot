import type { GlobalVendorArgs } from '@builderbot/bot/dist/types'
import { proto, WABrowserDescription, WAVersion } from 'baileys'

export type CallRecordFormat = 'wav' | 'mp3'

export interface CallRecordingOptions {
    enabled: boolean
    path?: string
    format?: CallRecordFormat
    autoAccept?: boolean
}

export interface CallRecord {
    callId: string
    from: string
    status: 'offer' | 'accept' | 'reject' | 'timeout' | 'terminate'
    startedAt: number
    endedAt?: number
    duration?: number
    format?: CallRecordFormat
    filePath?: string
}

export interface RelayEndpoint {
    ip: string
    port: number
    token?: Uint8Array
}

export interface ParsedCallOffer {
    callId: string
    from: string
    encKeys: Uint8Array[]
    relays: RelayEndpoint[]
    platformType?: string
}

export interface SRTPSessionKeys {
    cipherKey: Buffer
    cipherSalt: Buffer
    authKey: Buffer
}

export interface BaileyGlobalVendorArgs extends GlobalVendorArgs {
    gifPlayback: boolean
    usePairingCode: boolean
    phoneNumber: string | null
    browser: WABrowserDescription
    experimentalSyncMessage?: string
    fallBackAction?: (ctx: proto.IWebMessageInfo) => Promise<void>
    useBaileysStore: boolean
    timeRelease?: number
    experimentalStore?: boolean
    groupsIgnore: boolean
    readStatus: boolean
    version?: WAVersion //
    autoRefresh?: number
    host?: any
    callRecording?: CallRecordingOptions
}
