import type { GlobalVendorArgs } from '@builderbot/bot/dist/types'

export interface BaileyGlobalVendorArgs extends GlobalVendorArgs {
    gifPlayback: boolean
    usePairingCode: boolean
    phoneNumber: string | null
    browser: string[]
    experimentalSyncMessage?: string
    useBaileysStore: boolean
    timeRelease?: number
    experimentalStore?: boolean
    groupsIgnore: boolean
    readStatus: boolean
    autoRefresh?: number
    host?: any
}
