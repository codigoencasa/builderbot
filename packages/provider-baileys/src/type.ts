import type { GlobalVendorArgs } from '@builderbot/bot/dist/types'

export interface BaileyGlobalVendorArgs extends GlobalVendorArgs {
    gifPlayback: boolean
    timeRelease: number
    usePairingCode: boolean
    phoneNumber: string | null
    browser: string[]
    useBaileysStore: boolean
}
