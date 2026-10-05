/**
 * LAYER: Infrastructure
 * Contains: LiveSmokeHarness
 * Rules: Manual tool only. Runs in its own temporary cwd, never in the app cwd, and
 *        only sends to the linked account's own chat unless DEST is provided.
 * BigO: O(n) score:3
 * keywords: [LiveSmokeHarness, QrPairing, MediaSending]
 * GOAL: Prove live WhatsApp pairing, messaging, media and reconnection against the built provider.
 *
 * Usage (from packages/provider-baileys, after `pnpm build`):
 *
 *   node scripts/live-smoke.cjs                  # QR pairing (NV1-NV3) in a fresh session
 *   SEND=1 node scripts/live-smoke.cjs           # also send text + image to the own chat
 *   PHASE=resume SEND=1 node scripts/live-smoke.cjs   # NV4/NV5 with the saved session
 *   MEDIA=1 node scripts/live-smoke.cjs          # full outbound media batch (Batch A)
 *
 * Env:
 *   PHASE  pair (default) | resume   — resume keeps the previous session directory
 *   SEND   1 to send text + image after connecting
 *   MEDIA  1 to run the outbound media batch (image, video, audio, file, sticker,
 *          location, contact, poll, presence, sendMedia by URL and mp3->ffmpeg)
 *   DEST   destination number; defaults to the linked account's own chat
 *
 * Output: ASCII QR (also in <ROOT>/qr-blocks.log), <ROOT>/result-<phase>.json
 * WARNING: this links a real device to your WhatsApp account. Unlink it afterwards.
 * Do not point DEST at third parties: WhatsApp restricts accounts for cold outreach.
 */
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const PACKAGE_ROOT = path.resolve(__dirname, '..')
const ROOT = process.env.SMOKE_ROOT || path.join(os.tmpdir(), 'baileys-live-smoke')
const RUN_DIR = path.join(ROOT, 'run')
const ASSETS = path.join(ROOT, 'assets')
const PHASE = process.env.PHASE || 'pair'
const SEND = process.env.SEND === '1'
const MEDIA = process.env.MEDIA === '1'

const qrImage = require(path.join(PACKAGE_ROOT, 'node_modules', 'qr-image'))
const { BaileysProvider } = require(path.join(PACKAGE_ROOT, 'dist', 'index.cjs'))

const results = { phase: PHASE, checks: {}, events: [], incoming: [] }
const log = (...args) => {
    const line = `[${new Date().toISOString()}] ${args
        .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
        .join(' ')}`
    console.log(line)
    fs.appendFileSync(path.join(ROOT, `${PHASE}.log`), line + '\n')
}
const record = (name, ok, detail) => {
    results.checks[name] = { ok, detail, at: new Date().toISOString() }
    log(`CHECK ${name}: ${ok ? 'PASS' : 'FAIL'}${detail ? ' — ' + detail : ''}`)
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Masks a JID/phone so live logs and result files never expose real numbers. */
const mask = (value) => {
    const text = `${value ?? ''}`
    if (!text) return text
    const [local, domain] = text.split('@')
    const tail = local.slice(-4)
    return `${'*'.repeat(Math.max(local.length - 4, 0))}${tail}${domain ? '@' + domain : ''}`
}

const asciiQr = (text) => {
    const matrix = qrImage.matrix(text)
    let out = ''
    for (let y = 0; y < matrix.length; y += 2) {
        for (let x = 0; x < matrix[0].length; x++) {
            const top = matrix[y][x]
            const bottom = y + 1 < matrix.length ? matrix[y + 1][x] : 0
            out += top && bottom ? '█' : top ? '▀' : bottom ? '▄' : ' '
        }
        out += '\n'
    }
    return out
}

/** Generates the media batch assets. Missing tools/assets are skipped, not fatal. */
function buildAssets() {
    fs.mkdirSync(ASSETS, { recursive: true })
    const assets = {}
    const image = path.join(ASSETS, 'image.png')
    fs.writeFileSync(image, qrImage.imageSync(`smoke-${Date.now()}`, { type: 'png', size: 6 }))
    assets.image = image

    try {
        const video = path.join(ASSETS, 'video.mp4')
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=15', '-t', '3', '-pix_fmt', 'yuv420p', video])
        assets.video = video
    } catch {
        log('ffmpeg no disponible: se omite el vídeo')
    }

    const audioCandidates = [
        path.join(PACKAGE_ROOT, '..', 'bot', '__mock__', 'test.ogg'),
        path.join(PACKAGE_ROOT, '..', 'bot', '__mock__', 'test.opus'),
    ]
    const audioSource = audioCandidates.find((candidate) => fs.existsSync(candidate))
    if (audioSource) {
        const voice = path.join(ASSETS, 'voice.ogg')
        fs.copyFileSync(audioSource, voice)
        assets.voice = voice
    }

    const document = path.join(ASSETS, 'document.pdf')
    const stream = 'BT /F1 14 Tf 20 100 Td (live smoke document) Tj ET'
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ]
    const out = [Buffer.from('%PDF-1.4\n')]
    const offsets = []
    let size = out[0].length
    objects.forEach((body, index) => {
        offsets.push(size)
        const chunk = Buffer.from(`${index + 1} 0 obj\n${body}\nendobj\n`)
        out.push(chunk)
        size += chunk.length
    })
    const xref = size
    out.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`))
    offsets.forEach((offset) => out.push(Buffer.from(`${String(offset).padStart(10, '0')} 00000 n \n`)))
    out.push(Buffer.from(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`))
    fs.writeFileSync(document, Buffer.concat(out))
    assets.document = document
    return assets
}

async function main() {
    fs.mkdirSync(ROOT, { recursive: true })
    if (PHASE === 'pair') fs.rmSync(RUN_DIR, { recursive: true, force: true })
    fs.mkdirSync(RUN_DIR, { recursive: true })
    process.chdir(RUN_DIR)
    const assets = MEDIA ? buildAssets() : {}

    const server = http.createServer((req, res) => {
        const file = path.join(ASSETS, path.basename(req.url.split('?')[0]))
        if (!fs.existsSync(file)) {
            res.writeHead(404)
            return res.end('not found')
        }
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' })
        fs.createReadStream(file).pipe(res)
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const base = `http://127.0.0.1:${server.address().port}`

    const provider = new BaileysProvider({ name: 'smoke', port: 0, captureProcessSignals: false })
    let qrCount = 0
    let reconnected = false
    let sendAttempted = false
    let closeCount = 0

    provider.on('require_action', ({ payload }) => {
        if (!payload?.qr) return
        qrCount++
        const art = `===== QR #${qrCount} @ ${new Date().toISOString()} =====\n${asciiQr(payload.qr)}\n`
        console.log(`\n${art}`)
        // stdout is block-buffered when redirected; this file is not.
        fs.appendFileSync(path.join(ROOT, 'qr-blocks.log'), art)
        log(`qr#${qrCount} recibido`)
    })
    provider.on('auth_failure', (details) => {
        results.events.push({ type: 'auth_failure', details })
        log('AUTH_FAILURE', JSON.stringify(details))
    })
    provider.on('message', (ctx) => {
        results.incoming.push({ from: mask(ctx?.from), body: String(ctx?.body ?? '').slice(0, 80) })
        log('INCOMING', JSON.stringify({ from: mask(ctx?.from), body: String(ctx?.body ?? '').slice(0, 80) }))
        if (!results.checks.NV2in?.ok) record('NV2in', true, `entrante de ${ctx?.from}`)
    })

    let opened = false
    provider.on('ready', () => {
        if (opened) {
            reconnected = true
            record('NV5', true, `reconectado tras cierre #${closeCount}`)
            return
        }
        opened = true
        const host = provider.globalVendorArgs.host ?? {}
        record('NV1', true, `connection open tras ${qrCount} QR`)
        // Privacy: never log the full phone number / LID of a real account.
        log(`NV1 open host=${JSON.stringify({ ...host, phone: mask(host.phone), id: mask(host.id), lid: mask(host.lid) })}`)
        if (SEND && !sendAttempted) {
            sendAttempted = true
            runSends(provider, base, assets).catch((error) => log('SEND ERROR', error.message))
        }
    })

    async function sendTo(provider, dest, name, fn) {
        try {
            const out = await fn()
            record(name, true, out?.key?.id ? `id=${out.key.id}` : 'ok (sin key por contrato)')
        } catch (error) {
            record(name, false, error.message)
        }
        await delay(2500)
    }

    async function runSends(provider, base, assets) {
        const dest = process.env.DEST || provider.globalVendorArgs.host?.phone
        if (!dest) return record('NV2', false, 'sin destino')
        await sendTo(provider, dest, 'NV2', () => provider.sendText(dest, `live smoke ${new Date().toISOString()}`))
        if (assets.image) await sendTo(provider, dest, 'NV3', () => provider.sendImage(dest, assets.image, 'live smoke image'))

        if (MEDIA) {
            if (assets.video) await sendTo(provider, dest, 'sendVideo', () => provider.sendVideo(dest, assets.video, 'live smoke video'))
            if (assets.voice) await sendTo(provider, dest, 'sendAudio', () => provider.sendAudio(dest, assets.voice))
            if (assets.document) await sendTo(provider, dest, 'sendFile', () => provider.sendFile(dest, assets.document, 'live smoke doc'))
            if (assets.image) {
                await sendTo(provider, dest, 'sendSticker', () =>
                    provider.sendSticker(dest, assets.image, { pack: 'live-smoke', author: 'builderbot' })
                )
            }
            await sendTo(provider, dest, 'sendLocation', () => provider.sendLocation(dest, 40.4168, -3.7038))
            await sendTo(provider, dest, 'sendContact', () =>
                provider.sendContact(dest, { replaceAll: () => '15551230000' }, 'Live Smoke', 'builderbot')
            )
            await sendTo(provider, dest, 'sendPoll', () => provider.sendPoll(dest, 'live smoke poll', { options: ['A', 'B'] }))
            await sendTo(provider, dest, 'sendPresenceUpdate', async () => {
                await provider.sendPresenceUpdate(dest, 'composing')
                await delay(1000)
                await provider.sendPresenceUpdate(dest, 'paused')
                return { key: { id: 'presence' } }
            })
            if (assets.image) {
                await sendTo(provider, dest, 'sendMedia(url)', () => provider.sendMedia(dest, `${base}/image.png`, 'live smoke url'))
            }
        }

        // NV5: a forced socket close is a proxy for a network drop.
        setTimeout(async () => {
            closeCount++
            log('NV5: cerrando el socket a la fuerza')
            try {
                provider.vendor?.ws?.close()
            } catch (error) {
                log('NV5 close error', error.message)
            }
            await delay(60000)
            if (!reconnected) record('NV5', false, 'no reconectó en 60s')
        }, 5000)
    }

    const events = await provider.initVendor()
    if (events) provider.listenOnEvents(events)

    const hardStop = setTimeout(finish, 20 * 60 * 1000)
    process.on('SIGINT', finish)
    process.on('SIGTERM', finish)

    let finishing = false
    async function finish() {
        if (finishing) return
        finishing = true
        clearTimeout(hardStop)
        if (!results.checks.NV1?.ok) record('NV1', false, `sin connection open (qrCount=${qrCount})`)
        if (PHASE === 'resume') record('NV4', !!results.checks.NV1?.ok && qrCount === 0, `resume con qrCount=${qrCount}`)
        results.qrCount = qrCount
        results.reconnected = reconnected
        fs.writeFileSync(path.join(ROOT, `result-${PHASE}.json`), JSON.stringify(results, null, 2))
        log('RESULTS', JSON.stringify(results.checks))
        await provider.destroy()
        server.closeAllConnections()
        await new Promise((resolve) => server.close(resolve))
        process.exit(0)
    }

    log(`harness listo (phase=${PHASE}, send=${SEND}, media=${MEDIA})`)
}

main().catch((error) => {
    log('FATAL', error.stack || error.message)
    process.exit(1)
})
