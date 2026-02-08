import type { GlobalVendorArgs } from '@builderbot/bot/dist/types'
import { proto, WABrowserDescription, WAVersion } from 'baileys'

export type CallRecordFormat = 'wav' | 'mp3'

export interface CallRecordingOptions {
    enabled: boolean
    path?: string
    format?: CallRecordFormat
    autoReject?: boolean
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
