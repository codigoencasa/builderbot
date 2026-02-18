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
