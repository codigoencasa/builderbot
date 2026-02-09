/**
 * Native WhatsApp Call Recording Module
 *
 * Handles the full call recording lifecycle natively:
 * 1. Parse CB:call binary nodes to extract SRTP keys and relay endpoints
 * 2. Generate proper response nodes (preaccept, accept) via Baileys sendNode
 * 3. Connect to WhatsApp relay servers via UDP (dgram)
 * 4. Send STUN binding requests and handle relay communication
 * 5. Receive and decrypt SRTP packets (AES-128-CM + HMAC-SHA1)
 * 6. Extract Opus audio frames from RTP payload
 * 7. Pipe audio through FFmpeg to encode as WAV or MP3
 *
 * Protocol reference based on WA-Calls (bhavya32/WA-Calls):
 *   Offer → OfferAck → Preaccept → RelayLatencies → Transport → Accept
 */

import { createSocket } from 'dgram'
import type { Socket as UDPSocket } from 'dgram'
import { createDecipheriv, createHmac, randomBytes } from 'crypto'
import { existsSync, mkdirSync, createWriteStream } from 'fs'
import type { WriteStream } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import type { ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import ffmpegPath from '@ffmpeg-installer/ffmpeg'

import type { ParsedCallOffer, RelayEndpoint, SRTPSessionKeys, CallRecordFormat } from './type'

// ─── Constants ──────────────────────────────────────────────────────────────

const SRTP_HEADER_MIN = 12
const SRTP_AUTH_TAG_LEN = 10
const RTP_VERSION = 2

const STUN_MAGIC_COOKIE = 0x2112a442
const STUN_BINDING_REQUEST = 0x0001
const STUN_BINDING_RESPONSE = 0x0101

// ─── Call Packet Parser ─────────────────────────────────────────────────────

/**
 * Parse a CB:call BinaryNode to extract call offer data.
 * The BinaryNode from Baileys has: { tag, attrs, content }
 */
export function parseCallOfferPacket(packet: any): ParsedCallOffer | null {
    try {
        if (!packet || !packet.content) return null

        const content = Array.isArray(packet.content) ? packet.content : [packet.content]

        // Find the offer node inside the call packet
        const offerNode = content.find(
            (node: any) => node?.tag === 'offer' || node?.tag === 'relaylatency' || node?.tag === 'accept'
        )

        if (!offerNode) return null

        const callId = packet.attrs?.['call-id'] ?? offerNode.attrs?.['call-id'] ?? ''
        const from = packet.attrs?.from ?? ''
        const platformType = offerNode.attrs?.['platform-type'] ?? ''

        const encKeys: Uint8Array[] = []
        const relays: RelayEndpoint[] = []

        const children = Array.isArray(offerNode.content) ? offerNode.content : []

        for (const child of children) {
            // Encryption keys come in 'enc' nodes with raw Uint8Array content
            if (child.tag === 'enc' && child.content instanceof Uint8Array) {
                encKeys.push(child.content)
            }

            // Relay endpoints come in 'te2' nodes (or nested relay nodes)
            if (child.tag === 'te2' || child.tag === 'relay') {
                extractRelays(child, relays)
            }

            // Some versions have 'destination' with nested te2
            if (child.tag === 'destination' && Array.isArray(child.content)) {
                for (const sub of child.content) {
                    if (sub.tag === 'te2' || sub.tag === 'relay') {
                        extractRelays(sub, relays)
                    }
                }
            }
        }

        if (!callId && !from) return null

        return { callId, from, encKeys, relays, platformType }
    } catch {
        return null
    }
}

function extractRelays(node: any, relays: RelayEndpoint[]): void {
    if (Array.isArray(node.content)) {
        for (const entry of node.content) {
            if (entry.attrs?.ip && entry.attrs?.port) {
                relays.push({
                    ip: entry.attrs.ip,
                    port: parseInt(entry.attrs.port, 10),
                    token: entry.content instanceof Uint8Array ? entry.content : undefined,
                })
            }
        }
    } else if (node.attrs?.ip && node.attrs?.port) {
        relays.push({
            ip: node.attrs.ip,
            port: parseInt(node.attrs.port, 10),
            token: node.content instanceof Uint8Array ? node.content : undefined,
        })
    }
}

/**
 * Parse a CB:ack,class:call packet for relay info
 * The ack typically contains the te2 nodes with relay server endpoints
 */
export function parseCallAckPacket(packet: any): { relays: RelayEndpoint[]; token?: Uint8Array; key?: Uint8Array } {
    const relays: RelayEndpoint[] = []
    let token: Uint8Array | undefined
    let key: Uint8Array | undefined

    try {
        const content = Array.isArray(packet?.content) ? packet.content : []

        for (const node of content) {
            if (node.tag === 'te2' || node.tag === 'relay') {
                extractRelays(node, relays)
            }

            // Token node
            if (node.tag === 'token' && node.content instanceof Uint8Array) {
                token = node.content
            }

            // Additional key material
            if (node.tag === 'enc' && node.content instanceof Uint8Array) {
                key = node.content
            }

            // Nested content
            if (Array.isArray(node.content)) {
                for (const child of node.content) {
                    if (child.tag === 'te2' || child.tag === 'relay') {
                        extractRelays(child, relays)
                    }
                }
            }
        }
    } catch {
        // ignore parse errors
    }

    return { relays, token, key }
}

// ─── Call Signaling Node Builders ───────────────────────────────────────────

/**
 * Build a preaccept node to send back to the caller.
 * This signals that we can receive the call.
 */
export function buildPreacceptNode(callId: string, to: string, callCreator: string): any {
    return {
        tag: 'call',
        attrs: { to },
        content: [
            {
                tag: 'preaccept',
                attrs: {
                    'call-id': callId,
                    'call-creator': callCreator,
                },
                content: [
                    {
                        tag: 'audio',
                        attrs: { enc: 'opus', rate: '16000' },
                        content: undefined,
                    },
                ],
            },
        ],
    }
}

/**
 * Build an accept node to fully accept the call.
 */
export function buildAcceptNode(callId: string, to: string, callCreator: string): any {
    return {
        tag: 'call',
        attrs: { to },
        content: [
            {
                tag: 'accept',
                attrs: {
                    'call-id': callId,
                    'call-creator': callCreator,
                },
                content: [
                    {
                        tag: 'audio',
                        attrs: { enc: 'opus', rate: '16000' },
                        content: undefined,
                    },
                ],
            },
        ],
    }
}

// ─── STUN Helper ────────────────────────────────────────────────────────────

export function createSTUNBindingRequest(): Buffer {
    const msg = Buffer.alloc(20)
    msg.writeUInt16BE(STUN_BINDING_REQUEST, 0) // Type: Binding Request
    msg.writeUInt16BE(0, 2) // Message Length: 0 (no attributes)
    msg.writeUInt32BE(STUN_MAGIC_COOKIE, 4) // Magic Cookie
    randomBytes(12).copy(msg, 8) // Transaction ID
    return msg
}

export function isSTUNMessage(data: Buffer): boolean {
    if (data.length < 20) return false
    const firstByte = data[0]
    // STUN messages have first two bits as 00
    return (firstByte & 0xc0) === 0x00
}

export function isSTUNBindingResponse(data: Buffer): boolean {
    if (data.length < 20) return false
    const type = data.readUInt16BE(0)
    return type === STUN_BINDING_RESPONSE
}

// ─── SRTP Decryption ────────────────────────────────────────────────────────

/**
 * SRTP Key Derivation Function (RFC 3711 Section 4.3.1)
 *
 * Derives session keys from master key + master salt using AES-CM PRF.
 * Labels: 0x00 = cipher key, 0x01 = auth key, 0x02 = cipher salt
 */
function srtpKDF(masterKey: Buffer, masterSalt: Buffer, label: number, length: number): Buffer {
    // x = label || r (where r = 0 when key_derivation_rate = 0)
    const x = Buffer.alloc(14)
    masterSalt.copy(x, 0, 0, Math.min(14, masterSalt.length))
    x[7] ^= label

    const iv = Buffer.alloc(16)
    x.copy(iv, 0, 0, 14)

    const result = Buffer.alloc(length)
    let generated = 0
    let counter = 0

    while (generated < length) {
        const counterBlock = Buffer.alloc(16)
        iv.copy(counterBlock, 0, 0, 16)
        counterBlock[14] = (counter >> 8) & 0xff
        counterBlock[15] = counter & 0xff

        // AES-ECB to generate keystream block
        const cipher = createDecipheriv('aes-128-ecb', masterKey, null)
        cipher.setAutoPadding(false)
        const keystream = Buffer.concat([cipher.update(counterBlock), cipher.final()])

        const toCopy = Math.min(16, length - generated)
        keystream.copy(result, generated, 0, toCopy)
        generated += toCopy
        counter++
    }

    return result
}

/**
 * Derive SRTP session keys from a 32-byte master key material.
 * First 16 bytes = master key, next 14 bytes = master salt.
 */
export function deriveSRTPSessionKeys(masterKeyMaterial: Uint8Array): SRTPSessionKeys {
    const masterKey = Buffer.from(masterKeyMaterial.slice(0, 16))
    const masterSalt = Buffer.from(masterKeyMaterial.slice(16, 30))

    return {
        cipherKey: srtpKDF(masterKey, masterSalt, 0x00, 16), // SRTP encryption key
        cipherSalt: srtpKDF(masterKey, masterSalt, 0x02, 14), // SRTP salt
        authKey: srtpKDF(masterKey, masterSalt, 0x01, 20), // SRTP authentication key
    }
}

/**
 * Decrypt a single SRTP packet and return the RTP payload (Opus frame).
 *
 * SRTP packet structure:
 *   [RTP Header (12+ bytes)] [Encrypted Payload] [Auth Tag (10 bytes)]
 *
 * AES-128-CM decryption:
 *   IV = (cipherSalt XOR (SSRC || PacketIndex)) padded to 16 bytes
 *   Keystream = AES-ECB(cipherKey, IV + counter)
 *   Plaintext = Encrypted XOR Keystream
 */
export function decryptSRTPPacket(
    packet: Buffer,
    sessionKeys: SRTPSessionKeys,
    rolloverCounter: number = 0
): Buffer | null {
    const totalLen = packet.length
    if (totalLen < SRTP_HEADER_MIN + SRTP_AUTH_TAG_LEN) return null

    // Verify RTP version
    const version = (packet[0] >> 6) & 0x03
    if (version !== RTP_VERSION) return null

    const csrcCount = packet[0] & 0x0f
    const extension = (packet[0] >> 4) & 0x01
    const sequenceNumber = packet.readUInt16BE(2)
    const ssrc = packet.readUInt32BE(8)

    let headerLen = SRTP_HEADER_MIN + csrcCount * 4

    // Skip RTP header extension if present
    if (extension && totalLen > headerLen + 4) {
        const extLen = packet.readUInt16BE(headerLen + 2)
        headerLen += 4 + extLen * 4
    }

    if (headerLen >= totalLen - SRTP_AUTH_TAG_LEN) return null

    // 1. Verify authentication tag (HMAC-SHA1)
    const authenticated = packet.slice(0, totalLen - SRTP_AUTH_TAG_LEN)
    const authTag = packet.slice(totalLen - SRTP_AUTH_TAG_LEN)

    const hmac = createHmac('sha1', sessionKeys.authKey)
    hmac.update(authenticated)
    // Append ROC (rollover counter) as big-endian uint32
    const rocBuf = Buffer.alloc(4)
    rocBuf.writeUInt32BE(rolloverCounter, 0)
    hmac.update(rocBuf)
    const computedTag = hmac.digest().slice(0, SRTP_AUTH_TAG_LEN)

    if (!computedTag.equals(authTag)) {
        // Auth failed - might be wrong key set, skip packet
        return null
    }

    // 2. Decrypt payload using AES-128-CM
    const encPayload = packet.slice(headerLen, totalLen - SRTP_AUTH_TAG_LEN)
    const packetIndex = rolloverCounter * 65536 + sequenceNumber

    // Build IV: cipherSalt XOR (SSRC || packet_index)
    const iv = Buffer.alloc(16)
    sessionKeys.cipherSalt.copy(iv, 0, 0, 14)
    // XOR SSRC into bytes 4-7
    iv[4] ^= (ssrc >> 24) & 0xff
    iv[5] ^= (ssrc >> 16) & 0xff
    iv[6] ^= (ssrc >> 8) & 0xff
    iv[7] ^= ssrc & 0xff
    // XOR packet index into bytes 8-13
    iv[8] ^= (packetIndex >> 40) & 0xff
    iv[9] ^= (packetIndex >> 32) & 0xff
    iv[10] ^= (packetIndex >> 24) & 0xff
    iv[11] ^= (packetIndex >> 16) & 0xff
    iv[12] ^= (packetIndex >> 8) & 0xff
    iv[13] ^= packetIndex & 0xff

    // AES-CM: generate keystream blocks and XOR with encrypted payload
    const decrypted = Buffer.alloc(encPayload.length)
    let offset = 0
    let blockCounter = 0

    while (offset < encPayload.length) {
        const counterBlock = Buffer.alloc(16)
        iv.copy(counterBlock, 0, 0, 16)
        counterBlock[14] = (blockCounter >> 8) & 0xff
        counterBlock[15] = blockCounter & 0xff

        const cipher = createDecipheriv('aes-128-ecb', sessionKeys.cipherKey, null)
        cipher.setAutoPadding(false)
        const keystream = Buffer.concat([cipher.update(counterBlock), cipher.final()])

        for (let i = 0; i < 16 && offset + i < encPayload.length; i++) {
            decrypted[offset + i] = encPayload[offset + i] ^ keystream[i]
        }

        offset += 16
        blockCounter++
    }

    return decrypted.slice(0, encPayload.length)
}

/**
 * Check if a buffer looks like an RTP/SRTP packet
 */
export function isSRTPPacket(data: Buffer): boolean {
    if (data.length < SRTP_HEADER_MIN) return false
    const version = (data[0] >> 6) & 0x03
    return version === RTP_VERSION
}

// ─── Native Call Recorder ───────────────────────────────────────────────────

export interface NativeCallRecorderOptions {
    outputDir: string
    format: CallRecordFormat
    logger?: (msg: string) => void
}

interface ActiveRecording {
    callId: string
    from: string
    startedAt: number
    udpSocket: UDPSocket | null
    ffmpegProc: ChildProcess | null
    outputPath: string
    sessionKeys: SRTPSessionKeys | null
    relays: RelayEndpoint[]
    rolloverCounter: number
    lastSeq: number
    packetCount: number
    connected: boolean
}

export class NativeCallRecorder extends EventEmitter {
    private recordings: Map<string, ActiveRecording> = new Map()
    private outputDir: string
    private format: CallRecordFormat
    private log: (msg: string) => void

    constructor(options: NativeCallRecorderOptions) {
        super()
        this.outputDir = options.outputDir
        this.format = options.format
        this.log = options.logger ?? (() => {})

        if (!existsSync(this.outputDir)) {
            mkdirSync(this.outputDir, { recursive: true })
        }
    }

    /**
     * Handle a parsed call offer - prepare for recording.
     * Derives SRTP keys and sets up recording state.
     */
    prepareRecording(offer: ParsedCallOffer): void {
        if (this.recordings.has(offer.callId)) return

        // Derive session keys from the first encryption key (32 bytes: 16 key + 14 salt + padding)
        let sessionKeys: SRTPSessionKeys | null = null
        if (offer.encKeys.length > 0 && offer.encKeys[0].length >= 30) {
            sessionKeys = deriveSRTPSessionKeys(offer.encKeys[0])
        }

        const timestamp = Date.now()
        const safeName = offer.from.replace(/[^a-zA-Z0-9]/g, '_')
        const outputPath = join(this.outputDir, `call_${safeName}_${offer.callId}_${timestamp}.${this.format}`)

        const recording: ActiveRecording = {
            callId: offer.callId,
            from: offer.from,
            startedAt: timestamp,
            udpSocket: null,
            ffmpegProc: null,
            outputPath,
            sessionKeys,
            relays: offer.relays,
            rolloverCounter: 0,
            lastSeq: -1,
            packetCount: 0,
            connected: false,
        }

        this.recordings.set(offer.callId, recording)
        this.log(`[CallRecorder] Prepared recording for call ${offer.callId} from ${offer.from}`)
    }

    /**
     * Update relay endpoints from a CB:ack,class:call packet.
     */
    updateRelays(callId: string, relays: RelayEndpoint[], additionalKey?: Uint8Array): void {
        const rec = this.recordings.get(callId)
        if (!rec) return

        if (relays.length > 0) {
            rec.relays = [...rec.relays, ...relays]
        }

        // If we got additional key material and didn't have keys yet
        if (additionalKey && additionalKey.length >= 30 && !rec.sessionKeys) {
            rec.sessionKeys = deriveSRTPSessionKeys(additionalKey)
        }

        this.log(`[CallRecorder] Updated relays for ${callId}: ${rec.relays.length} endpoints`)
    }

    /**
     * Start actively recording a call.
     * Opens UDP socket, connects to relay, and starts FFmpeg pipeline.
     */
    async startRecording(callId: string): Promise<boolean> {
        const rec = this.recordings.get(callId)
        if (!rec) {
            this.log(`[CallRecorder] No prepared recording for ${callId}`)
            return false
        }

        if (rec.connected) return true

        if (rec.relays.length === 0) {
            this.log(`[CallRecorder] No relay endpoints available for ${callId}`)
            return false
        }

        try {
            // 1. Start FFmpeg process to encode audio
            this.startFFmpeg(rec)

            // 2. Create UDP socket and connect to first available relay
            rec.udpSocket = createSocket('udp4')

            rec.udpSocket.on('message', (data: Buffer) => {
                this.handleUDPMessage(rec, data)
            })

            rec.udpSocket.on('error', (err) => {
                this.log(`[CallRecorder] UDP error on ${callId}: ${err.message}`)
            })

            // Bind to random port
            await new Promise<void>((resolve, reject) => {
                rec.udpSocket!.bind(0, () => resolve())
                rec.udpSocket!.once('error', reject)
            })

            // 3. Send STUN binding requests to all relay endpoints
            for (const relay of rec.relays) {
                const stunReq = createSTUNBindingRequest()
                rec.udpSocket.send(stunReq, relay.port, relay.ip, (err) => {
                    if (err) {
                        this.log(`[CallRecorder] STUN send error to ${relay.ip}:${relay.port}: ${err.message}`)
                    } else {
                        this.log(`[CallRecorder] STUN binding sent to ${relay.ip}:${relay.port}`)
                    }
                })
            }

            rec.connected = true
            this.log(`[CallRecorder] Recording started for ${callId}`)
            this.emit('recording:started', { callId, from: rec.from, outputPath: rec.outputPath })
            return true
        } catch (err: any) {
            this.log(`[CallRecorder] Failed to start recording ${callId}: ${err.message}`)
            return false
        }
    }

    /**
     * Stop recording a call and finalize the output file.
     * Returns the path to the recorded file, or null if no recording was active.
     */
    async stopRecording(callId: string): Promise<string | null> {
        const rec = this.recordings.get(callId)
        if (!rec) return null

        this.log(
            `[CallRecorder] Stopping recording ${callId} (${rec.packetCount} packets captured)`
        )

        // Close UDP socket
        if (rec.udpSocket) {
            try {
                rec.udpSocket.close()
            } catch {
                // ignore
            }
            rec.udpSocket = null
        }

        // Close FFmpeg stdin to trigger finalization
        const outputPath = rec.outputPath
        if (rec.ffmpegProc && rec.ffmpegProc.stdin) {
            await new Promise<void>((resolve) => {
                rec.ffmpegProc!.stdin!.end(() => resolve())
                // If ffmpeg doesn't exit in 10s, kill it
                const timeout = setTimeout(() => {
                    rec.ffmpegProc?.kill('SIGKILL')
                    resolve()
                }, 10000)

                rec.ffmpegProc!.on('close', () => {
                    clearTimeout(timeout)
                    resolve()
                })
            })
        }

        rec.ffmpegProc = null
        this.recordings.delete(callId)

        const duration = Math.floor((Date.now() - rec.startedAt) / 1000)
        this.emit('recording:stopped', {
            callId,
            from: rec.from,
            outputPath,
            duration,
            packetCount: rec.packetCount,
        })

        this.log(`[CallRecorder] Recording saved: ${outputPath} (${duration}s, ${rec.packetCount} packets)`)
        return outputPath
    }

    /**
     * Check if a call is being recorded
     */
    isRecording(callId: string): boolean {
        return this.recordings.has(callId) && (this.recordings.get(callId)?.connected ?? false)
    }

    /**
     * Stop all active recordings
     */
    async stopAll(): Promise<void> {
        const callIds = Array.from(this.recordings.keys())
        for (const callId of callIds) {
            await this.stopRecording(callId)
        }
    }

    /**
     * Get the output path for a call
     */
    getOutputPath(callId: string): string | undefined {
        return this.recordings.get(callId)?.outputPath
    }

    // ─── Private Methods ────────────────────────────────────────────────

    /**
     * Start FFmpeg process to convert raw Opus audio to WAV/MP3.
     * Reads raw Opus packets from stdin, outputs encoded file.
     */
    private startFFmpeg(rec: ActiveRecording): void {
        const ffmpeg = ffmpegPath.path

        // FFmpeg args: read raw opus data from stdin, output to file
        const outputArgs =
            this.format === 'wav'
                ? ['-f', 'wav', '-acodec', 'pcm_s16le']
                : ['-f', 'mp3', '-acodec', 'libmp3lame', '-b:a', '128k']

        rec.ffmpegProc = spawn(ffmpeg, [
            '-y', // Overwrite output
            '-f', 'ogg', // Input format (Opus in OGG container)
            '-i', 'pipe:0', // Read from stdin
            '-ar', '16000', // Sample rate
            '-ac', '1', // Mono
            ...outputArgs,
            rec.outputPath,
        ], {
            stdio: ['pipe', 'pipe', 'pipe'],
        })

        rec.ffmpegProc.stderr?.on('data', (data: Buffer) => {
            // FFmpeg progress/debug output (only log if verbose)
        })

        rec.ffmpegProc.on('error', (err) => {
            this.log(`[CallRecorder] FFmpeg error: ${err.message}`)
        })

        rec.ffmpegProc.on('close', (code) => {
            if (code !== 0 && code !== null) {
                this.log(`[CallRecorder] FFmpeg exited with code ${code}`)
            }
        })
    }

    /**
     * Handle incoming UDP message - could be STUN response or SRTP packet
     */
    private handleUDPMessage(rec: ActiveRecording, data: Buffer): void {
        // STUN response
        if (isSTUNMessage(data)) {
            if (isSTUNBindingResponse(data)) {
                this.log(`[CallRecorder] STUN binding success for ${rec.callId}`)
            }
            return
        }

        // SRTP packet
        if (isSRTPPacket(data)) {
            this.handleSRTPPacket(rec, data)
        }
    }

    /**
     * Handle an SRTP packet: decrypt and pipe to FFmpeg
     */
    private handleSRTPPacket(rec: ActiveRecording, packet: Buffer): void {
        if (!rec.sessionKeys || !rec.ffmpegProc?.stdin?.writable) return

        // Track sequence number for rollover counter
        const seq = packet.readUInt16BE(2)
        if (rec.lastSeq >= 0 && seq < rec.lastSeq - 0x8000) {
            rec.rolloverCounter++
        }
        rec.lastSeq = seq

        // Decrypt SRTP → RTP payload (Opus frame)
        const opusFrame = decryptSRTPPacket(packet, rec.sessionKeys, rec.rolloverCounter)
        if (!opusFrame || opusFrame.length === 0) return

        rec.packetCount++

        // Write raw audio to FFmpeg stdin
        try {
            rec.ffmpegProc.stdin.write(opusFrame)
        } catch {
            // FFmpeg might have closed
        }
    }
}
