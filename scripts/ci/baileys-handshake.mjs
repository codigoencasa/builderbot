/**
 * Smoke test: does WhatsApp accept the installed Baileys release?
 *
 * Opens a socket with a fresh, throwaway auth state and waits for the first QR,
 * which only arrives after WhatsApp accepts the handshake. A 405 means the WA
 * Web version shipped by this release is rejected.
 *
 * Resolve `baileys` from the provider package (pnpm does not hoist it):
 *   cd packages/provider-baileys && node --input-type=module - < ../../scripts/ci/baileys-handshake.mjs
 *
 * Exit codes: 0 QR issued · 1 rejected (405) · 2 other close / timeout / error
 */
import makeWASocket, { DEFAULT_CONNECTION_CONFIG, useMultiFileAuthState } from 'baileys'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const TIMEOUT_MS = 45_000
const version = DEFAULT_CONNECTION_CONFIG.version
const silent = { level: 'silent', child: () => silent, trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {} }

const dir = await mkdtemp(join(tmpdir(), 'baileys-handshake-'))
const { state } = await useMultiFileAuthState(dir)

const outcome = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ code: 2, result: `timeout after ${TIMEOUT_MS} ms` }), TIMEOUT_MS)
    const done = (value) => {
        clearTimeout(timer)
        resolve(value)
    }
    try {
        const sock = makeWASocket({ auth: state, version, logger: silent, printQRInTerminal: false })
        sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
            if (qr) return done({ code: 0, result: 'QR issued (handshake accepted)', sock })
            if (connection !== 'close') return
            const status = lastDisconnect?.error?.output?.statusCode
            if (status === 405) return done({ code: 1, result: '405 Connection Failure (version rejected)', sock })
            done({ code: 2, result: `closed with status ${status ?? 'unknown'}`, sock })
        })
    } catch (error) {
        done({ code: 2, result: `error: ${error.message}` })
    }
})

try {
    outcome.sock?.ev.removeAllListeners('connection.update')
    outcome.sock?.end(undefined)
} catch {}
await rm(dir, { recursive: true, force: true })

console.log(`version=${version.join('.')}`)
console.log(`result=${outcome.result}`)
process.exit(outcome.code)
