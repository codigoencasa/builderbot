import type { GlobalVendorArgs } from '@builderbot/bot/dist/types'
import { proto, WABrowserDescription, WAVersion } from 'baileys'

import type { LidCache } from './lidCache'

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

    /**
     * Estrategia de caché para resolución LID→PN.
     * - 'file' (default): HybridLidCache (memory + file persistence)
     * - 'memory': MemoryLidCache (solo memoria, no persiste)
     * - LidCache: Implementación custom (e.g., Redis)
     */
    lidCache?: 'file' | 'memory' | LidCache

    /**
     * TTL (time-to-live) en segundos para entradas del LID cache.
     * Default: 604800 (7 días)
     */
    lidCacheTtl?: number
}
