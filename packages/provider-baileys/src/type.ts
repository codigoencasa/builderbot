import type { GlobalVendorArgs } from '@builderbot/bot/dist/types'
import type { BinaryNode, Contact, JidWithDevice, proto, WABrowserDescription, WAConnectionState, WAVersion } from 'baileys'

export type CallRecordFormat = 'wav' | 'mp3'

export interface WavoipOptions {
    token: string
    softwareBase?: string
    logger?: boolean
}

export interface CallRecordingOptions {
    enabled: boolean
    path?: string
    format?: CallRecordFormat
    autoReject?: boolean
    wavoip?: WavoipOptions
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

export type FailedResponseType = { wavoipStatus: string; result: any }

export interface WavoipServerToClientEvents {
    withAck: (d: string, callback: (e: number) => void) => void
    onWhatsApp: (jid: string, callback: (response: { exists: boolean; jid: string }[] | FailedResponseType | undefined) => void) => void
    profilePictureUrl: (
        jid: string,
        type: 'image' | 'preview',
        timeoutMs: number | undefined,
        callback: (response: string | FailedResponseType | undefined) => void
    ) => void
    assertSessions: (jids: string[], force: boolean, callback: (response: boolean | FailedResponseType) => void) => void
    createParticipantNodes: (
        jids: string[],
        message: any,
        extraAttrs: any,
        callback: {
            (nodes: any, shouldIncludeDeviceIdentity: boolean): void
            (response: FailedResponseType): void
        }
    ) => void
    getUSyncDevices: (
        jids: string[],
        useCache: boolean,
        ignoreZeroDevices: boolean,
        callback: (jids: JidWithDevice[] | FailedResponseType) => void
    ) => void
    generateMessageTag: (callback: (response: string | FailedResponseType) => void) => void
    sendNode: (stanza: BinaryNode, callback: (response: boolean | FailedResponseType) => void) => void
    'signalRepository:decryptMessage': (
        jid: string,
        type: 'pkmsg' | 'msg',
        ciphertext: Buffer,
        callback: (response: Uint8Array | FailedResponseType) => void
    ) => void
}

export interface WavoipClientToServerEvents {
    init: (
        me: Contact | undefined,
        account: proto.IADVSignedDeviceIdentity | undefined,
        status: WAConnectionState,
        softwareBase: string
    ) => void
    'CB:call': (packet: any) => void
    'CB:ack,class:call': (packet: any) => void
    'connection.update:status': (
        me: Contact | undefined,
        account: proto.IADVSignedDeviceIdentity | undefined,
        status: WAConnectionState
    ) => void
    'connection.update:qr': (qr: string) => void
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
