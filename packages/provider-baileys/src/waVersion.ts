/**
 * LAYER: Infrastructure
 * Contains: parseWaVersion, resolveWaVersion
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [WAVersion, parseWaVersion, resolveWaVersion]
 * GOAL: Own the "WhatsApp Web version" concern of the provider-baileys package.
 */
import { fetchLatestBaileysVersion, fetchLatestWaWebVersion } from './baileyWrapper'
import type { WAVersion } from './baileyWrapper'

export type WaVersionSource = 'manual' | 'baileys' | 'wa-web' | 'bundled'

export interface ResolvedWaVersion {
    version: WAVersion
    source: WaVersionSource
}

export interface ResolveWaVersionOptions {
    /** Version forced by the user (WA_VERSION or `version` option). */
    manual?: WAVersion
    /** Skip the manual version and try the live WhatsApp Web version first (after a 405). */
    preferLive?: boolean
    timeoutMs?: number
}

type VersionLookup = () => Promise<{ version?: unknown; error?: unknown } | undefined>

/** WA Web version shipped by the pinned Baileys release (rc14); keep in sync on upgrades. */
export const BUNDLED_WA_VERSION: WAVersion = [2, 3000, 1043857760]

export const WA_VERSION_LOOKUP_TIMEOUT_MS = 5000

/**
 * Accepts the formats users copy by hand:
 * `[2, 3000, 1054953954]`, `'2.3000.1054953954'`, `'2.3000.1054953954-alpha'`, `'2,3000,1054953954'`.
 * @returns the version, or `undefined` when the input is not a valid version
 */
const parseWaVersion = (input: unknown): WAVersion | undefined => {
    const parts = Array.isArray(input) ? input : typeof input === 'string' ? input.match(/\d+/g) : null
    if (!parts || parts.length !== 3) return undefined
    const version = parts.map(Number)
    if (!version.every((part) => Number.isSafeInteger(part) && part >= 0)) return undefined
    return version as WAVersion
}

/**
 * Baileys lookups never throw: on failure they return the bundled version with
 * `error` set. Treat that, a timeout or a malformed answer as "no answer".
 */
const lookup = async (fetcher: VersionLookup, timeoutMs: number): Promise<WAVersion | undefined> => {
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), timeoutMs)
        timer.unref?.()
    })
    try {
        const result = await Promise.race([Promise.resolve().then(fetcher), timeout])
        if (!result || result.error) return undefined
        return parseWaVersion(result.version)
    } catch {
        return undefined
    } finally {
        clearTimeout(timer)
    }
}

/**
 * Order: manual → Baileys-recommended → live WhatsApp Web → bundled.
 * With `preferLive` (WhatsApp rejected the previous version) the manual version
 * is skipped and the live WhatsApp Web version is tried first.
 */
const resolveWaVersion = async (options: ResolveWaVersionOptions = {}): Promise<ResolvedWaVersion> => {
    const { manual, preferLive = false, timeoutMs = WA_VERSION_LOOKUP_TIMEOUT_MS } = options
    if (manual && !preferLive) return { version: manual, source: 'manual' }

    const lookups: [WaVersionSource, VersionLookup][] = [
        ['baileys', () => fetchLatestBaileysVersion()],
        ['wa-web', () => fetchLatestWaWebVersion({})],
    ]
    if (preferLive) lookups.reverse()

    for (const [source, fetcher] of lookups) {
        const version = await lookup(fetcher, timeoutMs)
        if (version) return { version, source }
    }
    return { version: BUNDLED_WA_VERSION, source: 'bundled' }
}

export { parseWaVersion, resolveWaVersion }
