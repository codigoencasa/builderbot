import type { GlobalVendorArgs } from '@builderbot/bot/dist/types'

export interface BaileyGlobalVendorArgs extends GlobalVendorArgs {
    gifPlayback: boolean
    usePairingCode: boolean
    phoneNumber: string | null
    browser: string[]
    useBaileysStore: boolean
    timeRelease?: number
    experimentalStore?: boolean
    experimentalStoreArgs?: {
        messagesTypesAllowed: string[]
        storeContacts: boolean
        storeLabels: boolean
    }
    host?: any
}
