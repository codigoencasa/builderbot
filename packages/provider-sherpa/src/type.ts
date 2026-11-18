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
    /**
     * Manual WhatsApp Web version. Normally leave it unset: it is resolved automatically.
     * Accepts `[2, 3000, 1054953954]` or the text from https://wppconnect.io/whatsapp-versions/
     * (`'2.3000.1054953954-alpha'`). The `WA_VERSION` env var takes precedence.
     * Ignored after WhatsApp rejects it (405); the live version is used instead.
     */
    version?: WAVersion | string
    autoRefresh?: number
    host?: any
}
