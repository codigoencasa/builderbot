/**
 * Jest global teardown for @builderbot/provider-baileys.
 *
 * Tests create `<name>_sessions/` directories and `*.log` files in the package
 * cwd (see `.gitignore` lines 35 and 74). They are harmless but accumulate
 * hundreds of entries across runs, so we clean them after the suite finishes.
 *
 * Scope is intentionally narrow: only session dirs and log files directly under
 * the package root. Nothing else is touched.
 */
import { readdirSync, rmSync, statSync } from 'fs'
import { join } from 'path'

const SESSION_DIR_RE = /_sessions$/
const LOG_FILE_RE = /\.log$/
const QR_FILE_RE = /\.qr\.png$/

export default function globalTeardown(): void {
    const root = process.cwd()
    let removed = 0

    let entries: string[]
    try {
        entries = readdirSync(root)
    } catch {
        return
    }

    for (const entry of entries) {
        const fullPath = join(root, entry)

        const isDir = (() => {
            try {
                return statSync(fullPath).isDirectory()
            } catch {
                return false
            }
        })()

        const shouldRemove =
            (isDir && SESSION_DIR_RE.test(entry)) || (!isDir && (LOG_FILE_RE.test(entry) || QR_FILE_RE.test(entry)))

        if (!shouldRemove) continue

        try {
            rmSync(fullPath, { recursive: true, force: true })
            removed++
        } catch {
            // Best-effort cleanup: never fail the run because of a locked file.
        }
    }

    if (removed > 0) {
        console.log(`\n[provider-baileys] cleaned ${removed} test artifact(s)`)
    }
}
