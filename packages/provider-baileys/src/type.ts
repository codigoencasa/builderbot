/**
 * LAYER: Infrastructure
 * Contains: BaileyGlobalVendorArgs, GlobalVendorArgs, WABrowserDescription, WAVersion
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [BaileyGlobalVendorArgs, GlobalVendorArgs, WABrowserDescription, WAVersion]
 * GOAL: Own the "type" concern of the provider-baileys package.
 */
import type { GlobalVendorArgs } from '@builderbot/bot/dist/types'
import type { proto, WABrowserDescription, WAVersion } from 'baileys'

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

    /**
     * T15 option C: when `true`, group messages are delivered.
     * `from` is the group JID (`...@g.us`) and the author is exposed in
     * `participant` / `sender`. Takes precedence over `groupsIgnore` for groups
     * only (broadcasts still follow `groupsIgnore`). Default: `false`.
     */
    allowGroups?: boolean
    readStatus: boolean
    version?: WAVersion //
    autoRefresh?: number
    host?: any

    /**
     * When `true`, the provider registers its own `SIGINT`/`SIGTERM`/`SIGUSR1`/
     * `SIGUSR2` handlers to flush caches and shut down cleanly.
     *
     * Default `false`: the provider never touches process signals, so embedded
     * apps and other providers keep full control of shutdown. Call
     * {@link BaileysProvider.destroy} for explicit teardown.
     */
    captureProcessSignals?: boolean

    /**
     * Log level for the internal Baileys (pino) logger.
     * Default: 'error' — decrypt failures (Bad MAC, No session) stay visible.
     * Use 'fatal' to restore the previous silent behavior.
     */
    baileysLogLevel?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'

    /**
     * When `true`, a WhatsApp `loggedOut` (401) wipes the auth directory and
     * re-pairs automatically. Default `false`: auth files are preserved and an
     * `auth_failure` event is emitted instead (T7).
     */
    clearAuthOnLogout?: boolean

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
