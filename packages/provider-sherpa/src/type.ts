/**
 * LAYER: Infrastructure
 * Contains: SherpaGlobalVendorArgs, GlobalVendorArgs, WABrowserDescription, WAVersion
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [SherpaGlobalVendorArgs, GlobalVendorArgs, WABrowserDescription, WAVersion]
 * GOAL: Own the "type" concern of the provider-sherpa package.
 */
import type { GlobalVendorArgs } from '@builderbot/bot/dist/types'
import { proto, WABrowserDescription, WAVersion } from 'whaileys'
export interface SherpaGlobalVendorArgs extends GlobalVendorArgs {
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
}
