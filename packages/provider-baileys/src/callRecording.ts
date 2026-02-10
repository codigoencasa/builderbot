/**
 * Native WhatsApp Call Recording Module
 *
 * Based on verified protocol research from:
 * - WPPConnect/wa-js (offer.ts, accept.ts, parseRelayResponse.ts, prepareDestination.ts)
 * - bhavya32/WA-Calls (helper.ts, wavoip_handler.ts, types.ts)
 * - WhatsApp Encryption Whitepaper (SRTP master secret, HKDF-SHA256)
 * - Marvin Schirrmacher's analysis (AES-128-ICM, libsrtp, PJSIP)
 * - webrtcHacks WhatsApp report (WASP protocol, custom STUN 0x4000+)
 * - nDPI source (WhatsApp call STUN attribute detection)
 *
 * Protocol flow:
 *   1. CB:call [offer] → enc nodes (Signal Protocol encrypted callKey 32 bytes)
 *   2. Send custom ACK → {tag:'ack', attrs:{id, to, class:'call', type:'offer'}}
 *   3. Server response → rte + relay (te2 6-byte IP:port, tokens, key)
 *   4. WASP/STUN → custom attrs 0x4000-0x4007 to relay IP:port
 *   5. Send accept → audio(opus 16k/8k) + net(medium:3) + encopt(keygen:2)
 *   6. SRTP audio → AES-128-ICM with keys from HKDF-SHA256(master_secret)
 */

import { createSocket } from 'dgram'
import type { Socket as UDPSocket } from 'dgram'
import { createHmac, randomBytes } from 'crypto'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import type { ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

import type { ParsedCallOffer, EncNodeData, RelayEndpoint, SRTPSessionKeys, CallRecordFormat } from './type'

// ─── Constants ──────────────────────────────────────────────────────────────

const SRTP_HEADER_MIN = 12
const SRTP_AUTH_TAG_LEN = 10
const RTP_VERSION = 2

// WASP (WhatsApp STUN Protocol) custom attributes
const WASP_ATTR_TOKEN = 0x4000
const WASP_ATTR_UNKNOWN_1 = 0x4001
const WASP_ATTR_ROUTE = 0x4002
const WASP_ATTR_FLAGS = 0x4003

// STUN constants
const STUN_MAGIC_COOKIE = 0x2112a442
const STUN_BINDING_REQUEST = 0x0001
const STUN_BINDING_RESPONSE = 0x0101

// WhatsApp-specific STUN message types (from nDPI)
const WASP_MSG_ALLOCATE = 0x0800
const WASP_MSG_ALLOCATE_RESPONSE = 0x0801
const WASP_MSG_SEND = 0x0802
const WASP_MSG_DATA = 0x0804
const WASP_MSG_ACK = 0x0805

// ─── Call Packet Parser ─────────────────────────────────────────────────────

/**
 * Parse a CB:call BinaryNode to extract call offer data.
 *
 * Offer structure (verified from WPPConnect wa-js):
 * {
 *   tag: 'call', attrs: { from, id },
 *   content: [{
 *     tag: 'offer',
 *     attrs: { 'call-id', 'call-creator' },
 *     content: [
 *       { tag: 'audio', attrs: { enc:'opus', rate:'16000' } },
 *       { tag: 'audio', attrs: { enc:'opus', rate:'8000' } },
 *       { tag: 'net', attrs: { medium:'3' } },
 *       { tag: 'capability', attrs: { ver:'1' }, content: Uint8Array },
 *       { tag: 'encopt', attrs: { keygen:'2' } },
 *       { tag: 'destination', content: [{ tag: 'to', content: [{ tag: 'enc', ... }] }] }
 *     ]
 *   }]
 * }
 */
export function parseCallOfferPacket(packet: any): ParsedCallOffer | null {
    try {
        if (!packet || !packet.content) return null

        const content = Array.isArray(packet.content) ? packet.content : [packet.content]

        const offerNode = content.find(
            (node: any) =>
                node?.tag === 'offer' ||
                node?.tag === 'relaylatency' ||
                node?.tag === 'transport' ||
                node?.tag === 'accept'
        )

        if (!offerNode) return null

        const callId = offerNode.attrs?.['call-id'] ?? packet.attrs?.['call-id'] ?? ''
        const from = packet.attrs?.from ?? ''
        const callCreator = offerNode.attrs?.['call-creator'] ?? from
        const platformType = offerNode.attrs?.['platform-type'] ?? ''

        const encNodes: EncNodeData[] = []
        const relays: RelayEndpoint[] = []

        const children = Array.isArray(offerNode.content) ? offerNode.content : []

        const extractEncNode = (node: any): void => {
            if (node.tag === 'enc' && node.content instanceof Uint8Array) {
                encNodes.push({
                    ciphertext: node.content,
                    type: node.attrs?.type ?? 'pkmsg',
                    version: node.attrs?.v,
                    count: node.attrs?.count,
                })
            }
        }

        for (const child of children) {
            // Enc nodes: Signal Protocol encrypted, contain callKey (32 bytes) after decryption
            // Structure: { tag: 'enc', attrs: { v:'2', type:'pkmsg'|'msg', count:'0' }, content: ciphertext }
            extractEncNode(child)

            // Relay endpoints in te2 nodes: 6 bytes = IP(4) + Port(2 BE)
            // Verified from parseRelayResponse.ts
            if (child.tag === 'te2') {
                const endpoint = extractRelayFromBinary(child)
                if (endpoint) relays.push(endpoint)
            }

            if (child.tag === 'relay') {
                extractRelayChildren(child, relays)
            }

            // Destination nodes contain nested enc keys per device
            if (child.tag === 'destination' && Array.isArray(child.content)) {
                for (const toNode of child.content) {
                    if (toNode.tag === 'to' && Array.isArray(toNode.content)) {
                        for (const encNode of toNode.content) {
                            extractEncNode(encNode)
                        }
                    }
                }
            }
        }

        if (!callId && !from) return null

        return { callId, from, encNodes, relays, platformType }
    } catch {
        return null
    }
}

/**
 * Extract relay endpoint from a te2 binary node.
 * Format: 6 bytes = [IP0, IP1, IP2, IP3, PortHi, PortLo]
 * Verified from WPPConnect parseRelayResponse.ts extractIpPort()
 */
function extractRelayFromBinary(node: any): RelayEndpoint | null {
    // Method 1: Binary content (6 bytes) - verified from WPPConnect
    if (node.content instanceof Uint8Array && node.content.length === 6) {
        const data = node.content
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
        const ip = `${view.getUint8(0)}.${view.getUint8(1)}.${view.getUint8(2)}.${view.getUint8(3)}`
        const port = view.getUint16(4)
        const relayId = node.attrs?.relay_id
        const tokenId = node.attrs?.token_id
        return { ip, port, token: undefined, relayId, tokenId }
    }

    // Method 2: Attributes (fallback for some Baileys versions)
    if (node.attrs?.ip && node.attrs?.port) {
        return {
            ip: node.attrs.ip,
            port: parseInt(node.attrs.port, 10),
            token: node.content instanceof Uint8Array ? node.content : undefined,
        }
    }

    return null
}

function extractRelayChildren(node: any, relays: RelayEndpoint[]): void {
    if (!Array.isArray(node.content)) return

    const tokens: Map<string, Uint8Array> = new Map()

    for (const child of node.content) {
        // Token nodes
        if (child.tag === 'token' && child.content instanceof Uint8Array) {
            const id = child.attrs?.id ?? '0'
            tokens.set(id, child.content)
        }

        // te2 nodes with 6-byte binary content
        if (child.tag === 'te2') {
            const endpoint = extractRelayFromBinary(child)
            if (endpoint) {
                // Attach token if referenced
                if (endpoint.tokenId && tokens.has(endpoint.tokenId)) {
                    endpoint.token = tokens.get(endpoint.tokenId)
                }
                relays.push(endpoint)
            }
        }
    }
}

/**
 * Parse a CB:ack,class:call packet for relay info.
 * The server response contains: rte, relay (with key, tokens, te2 nodes)
 * Verified from WPPConnect parseRelayResponse.ts
 */
export function parseCallAckPacket(packet: any): {
    relays: RelayEndpoint[]
    relayKey?: string
    tokens: Map<string, Uint8Array>
} {
    const relays: RelayEndpoint[] = []
    const tokens: Map<string, Uint8Array> = new Map()
    let relayKey: string | undefined

    try {
        const content = Array.isArray(packet?.content) ? packet.content : []

        for (const node of content) {
            // Direct te2 nodes
            if (node.tag === 'te2') {
                const ep = extractRelayFromBinary(node)
                if (ep) relays.push(ep)
            }

            // Relay container (verified structure from parseRelayResponse.ts)
            if (node.tag === 'relay' && Array.isArray(node.content)) {
                for (const child of node.content) {
                    // Key node: UTF-8 string
                    if (child.tag === 'key' && child.content instanceof Uint8Array) {
                        relayKey = new TextDecoder().decode(child.content)
                    }

                    // Token nodes: binary content, indexed by id
                    if (child.tag === 'token' && child.content instanceof Uint8Array) {
                        tokens.set(child.attrs?.id ?? '0', child.content)
                    }

                    // te2 nodes: 6-byte relay endpoints
                    if (child.tag === 'te2') {
                        const ep = extractRelayFromBinary(child)
                        if (ep) {
                            if (ep.tokenId && tokens.has(ep.tokenId)) {
                                ep.token = tokens.get(ep.tokenId)
                            }
                            relays.push(ep)
                        }
                    }
                }
            }

            // rte node (route endpoint)
            if (node.tag === 'rte') {
                const ep = extractRelayFromBinary(node)
                if (ep) relays.push(ep)
            }
        }
    } catch {
        // ignore parse errors
    }

    return { relays, relayKey, tokens }
}

// ─── Call Signaling Node Builders ───────────────────────────────────────────

/**
 * Build custom ACK for a received call node.
 * REQUIRED after receiving any call offer.
 * Verified from WA-Calls helper.ts sendCustomAck()
 */
export function buildCustomAck(packet: any): any {
    const attrs: Record<string, string> = {
        id: packet.attrs?.id ?? '',
        to: packet.attrs?.from ?? '',
        class: 'call',
    }

    // Add type from the first content child (e.g., 'offer', 'transport')
    if (Array.isArray(packet.content) && packet.content.length > 0) {
        attrs.type = packet.content[0].tag
    }

    return { tag: 'ack', attrs }
}

/**
 * Build an accept node to accept an incoming call.
 * Verified from WPPConnect wa-js accept.ts — exact node structure:
 *
 * {
 *   tag: 'call',
 *   attrs: { to: peerJid, id: generateId() },
 *   content: [{
 *     tag: 'accept',
 *     attrs: { 'call-id': callId, 'call-creator': peerJid },
 *     content: [
 *       { tag: 'audio', attrs: { enc:'opus', rate:'16000' }, content: null },
 *       { tag: 'audio', attrs: { enc:'opus', rate:'8000' }, content: null },
 *       { tag: 'net', attrs: { medium:'3' }, content: null },
 *       { tag: 'encopt', attrs: { keygen:'2' }, content: null },
 *     ]
 *   }]
 * }
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
                    { tag: 'audio', attrs: { enc: 'opus', rate: '16000' } },
                    { tag: 'audio', attrs: { enc: 'opus', rate: '8000' } },
                    { tag: 'net', attrs: { medium: '3' } },
                    { tag: 'encopt', attrs: { keygen: '2' } },
                ],
            },
        ],
    }
}

/**
 * Build a terminate node to end a call.
 * Verified from WPPConnect wa-js end.ts
 */
export function buildTerminateNode(callId: string, to: string, callCreator: string): any {
    return {
        tag: 'call',
        attrs: { to },
        content: [
            {
                tag: 'terminate',
                attrs: {
                    'call-id': callId,
                    'call-creator': callCreator,
                },
            },
        ],
    }
}

// ─── STUN / WASP Helper ────────────────────────────────────────────────────

/**
 * Create a STUN Binding Request.
 * WhatsApp uses WASP (WhatsApp STUN Protocol) with custom attributes.
 */
export function createSTUNBindingRequest(token?: Uint8Array): Buffer {
    const transactionId = randomBytes(12)

    // Calculate total attribute length
    let attrsLen = 0
    if (token) {
        // WASP_ATTR_TOKEN (0x4000): type(2) + length(2) + value + padding
        const paddedLen = token.length + (4 - (token.length % 4)) % 4
        attrsLen += 4 + paddedLen
    }

    const msg = Buffer.alloc(20 + attrsLen)

    // Header
    msg.writeUInt16BE(STUN_BINDING_REQUEST, 0)
    msg.writeUInt16BE(attrsLen, 2)
    msg.writeUInt32BE(STUN_MAGIC_COOKIE, 4)
    transactionId.copy(msg, 8)

    // WASP token attribute (0x4000)
    if (token) {
        let offset = 20
        msg.writeUInt16BE(WASP_ATTR_TOKEN, offset)
        msg.writeUInt16BE(token.length, offset + 2)
        Buffer.from(token).copy(msg, offset + 4)
    }

    return msg
}

export function isSTUNMessage(data: Buffer): boolean {
    if (data.length < 20) return false
    // STUN messages have first two bits as 00
    return (data[0] & 0xc0) === 0x00
}

export function isSTUNBindingResponse(data: Buffer): boolean {
    if (data.length < 20) return false
    const type = data.readUInt16BE(0)
    // Standard STUN or WASP responses
    return (
        type === STUN_BINDING_RESPONSE ||
        type === WASP_MSG_ALLOCATE_RESPONSE ||
        type === WASP_MSG_DATA ||
        type === WASP_MSG_ACK
    )
}

// ─── SRTP Key Derivation ────────────────────────────────────────────────────

/**
 * Derive SRTP session keys from a 32-byte master secret using HKDF-SHA256.
 *
 * WhatsApp generates a random 32-byte SRTP master secret (whitepaper confirmed).
 * Key derivation uses HKDF-SHA256 (encopt keygen:'2') to produce:
 *   - 16-byte cipher key (AES-128-ICM)
 *   - 14-byte cipher salt
 *   - 20-byte auth key (HMAC-SHA1)
 *
 * HKDF flow: Extract → Expand with different info labels
 */
function hkdfSha256(ikm: Buffer, salt: Buffer, info: Buffer, length: number): Buffer {
    // Extract: PRK = HMAC-SHA256(salt, IKM)
    const prk = createHmac('sha256', salt).update(ikm).digest()

    // Expand: OKM = T(1) || T(2) || ... where T(i) = HMAC-SHA256(PRK, T(i-1) || info || i)
    const n = Math.ceil(length / 32)
    const okm = Buffer.alloc(n * 32)
    let prev = Buffer.alloc(0)

    for (let i = 1; i <= n; i++) {
        const hmac = createHmac('sha256', prk)
        hmac.update(prev)
        hmac.update(info)
        hmac.update(Buffer.from([i]))
        prev = hmac.digest()
        prev.copy(okm, (i - 1) * 32)
    }

    return okm.slice(0, length)
}

/**
 * Derive SRTP session keys from WhatsApp's 32-byte SRTP master secret.
 * Uses HKDF-SHA256 as indicated by encopt keygen:'2'.
 */
export function deriveSRTPSessionKeys(masterSecret: Uint8Array): SRTPSessionKeys {
    const ikm = Buffer.from(masterSecret)
    const salt = Buffer.alloc(32) // Default empty salt for HKDF

    // Derive cipher key (AES-128-ICM = AES-128-CM, 16 bytes)
    const cipherKey = hkdfSha256(ikm, salt, Buffer.from('oRTP cipher key'), 16)
    // Derive cipher salt (14 bytes)
    const cipherSalt = hkdfSha256(ikm, salt, Buffer.from('oRTP cipher salt'), 14)
    // Derive auth key (HMAC-SHA1, 20 bytes)
    const authKey = hkdfSha256(ikm, salt, Buffer.from('oRTP auth key'), 20)

    return { cipherKey, cipherSalt, authKey }
}

// ─── SRTP Decryption ────────────────────────────────────────────────────────

/**
 * Decrypt a single SRTP packet (AES-128-ICM = AES-128-CM, RFC 3711 Section 4).
 *
 * AES-128-ICM generates a keystream by encrypting sequential counter blocks,
 * then XORs the keystream with the encrypted payload.
 *
 * IV = cipherSalt XOR (SSRC || packet_index), padded to 16 bytes
 * Keystream = AES-ECB(cipherKey, IV + counter)
 * Plaintext = Encrypted XOR Keystream
 * Auth = HMAC-SHA1(authKey, header || encrypted_payload || ROC)
 */
export function decryptSRTPPacket(
    packet: Buffer,
    sessionKeys: SRTPSessionKeys,
    rolloverCounter: number = 0
): Buffer | null {
    const totalLen = packet.length
    if (totalLen < SRTP_HEADER_MIN + SRTP_AUTH_TAG_LEN) return null

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

    // 1. Verify HMAC-SHA1 authentication tag
    const authenticated = packet.slice(0, totalLen - SRTP_AUTH_TAG_LEN)
    const authTag = packet.slice(totalLen - SRTP_AUTH_TAG_LEN)

    const hmac = createHmac('sha1', sessionKeys.authKey)
    hmac.update(authenticated)
    const rocBuf = Buffer.alloc(4)
    rocBuf.writeUInt32BE(rolloverCounter, 0)
    hmac.update(rocBuf)
    const computedTag = hmac.digest().slice(0, SRTP_AUTH_TAG_LEN)

    if (!computedTag.equals(authTag)) {
        return null
    }

    // 2. Decrypt payload with AES-128-ICM (= AES-128-CM)
    const encPayload = packet.slice(headerLen, totalLen - SRTP_AUTH_TAG_LEN)
    const packetIndex = rolloverCounter * 65536 + sequenceNumber

    // Build IV: cipherSalt XOR (SSRC || packet_index)
    const iv = Buffer.alloc(16)
    sessionKeys.cipherSalt.copy(iv, 0, 0, 14)
    iv[4] ^= (ssrc >> 24) & 0xff
    iv[5] ^= (ssrc >> 16) & 0xff
    iv[6] ^= (ssrc >> 8) & 0xff
    iv[7] ^= ssrc & 0xff
    iv[8] ^= (packetIndex >> 40) & 0xff
    iv[9] ^= (packetIndex >> 32) & 0xff
    iv[10] ^= (packetIndex >> 24) & 0xff
    iv[11] ^= (packetIndex >> 16) & 0xff
    iv[12] ^= (packetIndex >> 8) & 0xff
    iv[13] ^= packetIndex & 0xff

    // AES-ICM: encrypt counter blocks and XOR with payload
    // Use createCipheriv with aes-128-ecb to generate keystream blocks
    const { createCipheriv } = require('crypto')
    const decrypted = Buffer.alloc(encPayload.length)
    let offset = 0
    let blockCounter = 0

    while (offset < encPayload.length) {
        const counterBlock = Buffer.alloc(16)
        iv.copy(counterBlock, 0, 0, 16)
        counterBlock[14] = (blockCounter >> 8) & 0xff
        counterBlock[15] = blockCounter & 0xff

        const cipher = createCipheriv('aes-128-ecb', sessionKeys.cipherKey, null)
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

export function isSRTPPacket(data: Buffer): boolean {
    if (data.length < SRTP_HEADER_MIN) return false
    const version = (data[0] >> 6) & 0x03
    return version === RTP_VERSION
}

// ─── Signal Protocol callKey Decoder ────────────────────────────────────────

/**
 * Decode the SRTP master secret (callKey) from a decrypted Signal Protocol message.
 * The enc node content is Signal-encrypted. After decryption, it's a protobuf:
 *   proto.Message { call: { callKey: Uint8Array(32) } }
 *
 * Verified from WA-Calls helper.ts decodePkmsg()
 */
export function extractCallKeyFromDecryptedMessage(decryptedBuffer: Uint8Array): Uint8Array | null {
    try {
        // Import proto from baileys for protobuf decoding
        const { proto } = require('baileys')

        // The decrypted buffer may have random padding (unpadRandomMax16)
        // Try to find valid protobuf data
        const msg = proto.Message.decode(decryptedBuffer)
        if (msg?.call?.callKey && msg.call.callKey.length >= 32) {
            return msg.call.callKey
        }
        return null
    } catch {
        return null
    }
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
    callCreator: string
    startedAt: number
    udpSocket: UDPSocket | null
    ffmpegProc: ChildProcess | null
    outputPath: string
    sessionKeys: SRTPSessionKeys | null
    masterSecret: Uint8Array | null
    relays: RelayEndpoint[]
    relayKey?: string
    tokens: Map<string, Uint8Array>
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
     * Prepare recording state from a parsed call offer.
     */
    prepareRecording(offer: ParsedCallOffer): void {
        if (this.recordings.has(offer.callId)) return

        const timestamp = Date.now()
        const safeName = offer.from.replace(/[^a-zA-Z0-9]/g, '_')
        const outputPath = join(this.outputDir, `call_${safeName}_${offer.callId}_${timestamp}.${this.format}`)

        const recording: ActiveRecording = {
            callId: offer.callId,
            from: offer.from,
            callCreator: offer.from,
            startedAt: timestamp,
            udpSocket: null,
            ffmpegProc: null,
            outputPath,
            sessionKeys: null,
            masterSecret: null,
            relays: offer.relays,
            relayKey: undefined,
            tokens: new Map(),
            rolloverCounter: 0,
            lastSeq: -1,
            packetCount: 0,
            connected: false,
        }

        this.recordings.set(offer.callId, recording)
        this.log(`[CallRecorder] Prepared recording for ${offer.callId} from ${offer.from}`)
    }

    /**
     * Set the decrypted SRTP master secret (callKey) for a call.
     * This must be called after Signal Protocol decryption of the enc nodes.
     */
    setMasterSecret(callId: string, masterSecret: Uint8Array): void {
        const rec = this.recordings.get(callId)
        if (!rec) return

        rec.masterSecret = masterSecret
        rec.sessionKeys = deriveSRTPSessionKeys(masterSecret)
        this.log(`[CallRecorder] SRTP keys derived for ${callId} (master secret: ${masterSecret.length} bytes)`)
    }

    /**
     * Update relay info from a server response (CB:ack,class:call).
     */
    updateRelays(
        callId: string,
        relays: RelayEndpoint[],
        relayKey?: string,
        tokens?: Map<string, Uint8Array>
    ): void {
        const rec = this.recordings.get(callId)
        if (!rec) return

        if (relays.length > 0) {
            rec.relays = [...rec.relays, ...relays]
        }
        if (relayKey) rec.relayKey = relayKey
        if (tokens) {
            tokens.forEach((v, k) => rec.tokens.set(k, v))
            // Attach tokens to relays that reference them
            for (const relay of rec.relays) {
                if (relay.tokenId && rec.tokens.has(relay.tokenId)) {
                    relay.token = rec.tokens.get(relay.tokenId)
                }
            }
        }

        this.log(`[CallRecorder] Updated relays for ${callId}: ${rec.relays.length} endpoints`)
    }

    /**
     * Start recording. Opens UDP, connects to relay via WASP, starts FFmpeg.
     */
    async startRecording(callId: string): Promise<boolean> {
        const rec = this.recordings.get(callId)
        if (!rec) {
            this.log(`[CallRecorder] No prepared recording for ${callId}`)
            return false
        }
        if (rec.connected) return true
        if (rec.relays.length === 0) {
            this.log(`[CallRecorder] No relay endpoints for ${callId}`)
            return false
        }

        try {
            this.startFFmpeg(rec)

            rec.udpSocket = createSocket('udp4')
            rec.udpSocket.on('message', (data: Buffer) => this.handleUDPMessage(rec, data))
            rec.udpSocket.on('error', (err) =>
                this.log(`[CallRecorder] UDP error ${callId}: ${err.message}`)
            )

            await new Promise<void>((resolve, reject) => {
                rec.udpSocket!.bind(0, () => resolve())
                rec.udpSocket!.once('error', reject)
            })

            // Send WASP binding requests to all relay endpoints
            for (const relay of rec.relays) {
                const stunReq = createSTUNBindingRequest(relay.token)
                rec.udpSocket.send(stunReq, relay.port, relay.ip, (err) => {
                    if (err) {
                        this.log(`[CallRecorder] WASP send error to ${relay.ip}:${relay.port}: ${err.message}`)
                    } else {
                        this.log(`[CallRecorder] WASP binding sent to ${relay.ip}:${relay.port}`)
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

    async stopRecording(callId: string): Promise<string | null> {
        const rec = this.recordings.get(callId)
        if (!rec) return null

        this.log(`[CallRecorder] Stopping recording ${callId} (${rec.packetCount} packets)`)

        if (rec.udpSocket) {
            try { rec.udpSocket.close() } catch { /* ignore */ }
            rec.udpSocket = null
        }

        const outputPath = rec.outputPath
        if (rec.ffmpegProc?.stdin) {
            await new Promise<void>((resolve) => {
                rec.ffmpegProc!.stdin!.end(() => resolve())
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
        this.emit('recording:stopped', { callId, from: rec.from, outputPath, duration, packetCount: rec.packetCount })
        this.log(`[CallRecorder] Saved: ${outputPath} (${duration}s, ${rec.packetCount} packets)`)
        return outputPath
    }

    isRecording(callId: string): boolean {
        return this.recordings.has(callId) && (this.recordings.get(callId)?.connected ?? false)
    }

    async stopAll(): Promise<void> {
        for (const callId of Array.from(this.recordings.keys())) {
            await this.stopRecording(callId)
        }
    }

    getOutputPath(callId: string): string | undefined {
        return this.recordings.get(callId)?.outputPath
    }

    // ─── Private ────────────────────────────────────────────────────────

    private startFFmpeg(rec: ActiveRecording): void {
        const ffmpeg = ffmpegInstaller.path
        const outputArgs =
            this.format === 'wav'
                ? ['-f', 'wav', '-acodec', 'pcm_s16le']
                : ['-f', 'mp3', '-acodec', 'libmp3lame', '-b:a', '128k']

        rec.ffmpegProc = spawn(
            ffmpeg,
            [
                '-y',
                '-f', 'ogg',
                '-i', 'pipe:0',
                '-ar', '16000',
                '-ac', '1',
                ...outputArgs,
                rec.outputPath,
            ],
            { stdio: ['pipe', 'pipe', 'pipe'] }
        )

        rec.ffmpegProc.on('error', (err) => this.log(`[CallRecorder] FFmpeg error: ${err.message}`))
        rec.ffmpegProc.on('close', (code) => {
            if (code && code !== 0) this.log(`[CallRecorder] FFmpeg exit code ${code}`)
        })
    }

    private handleUDPMessage(rec: ActiveRecording, data: Buffer): void {
        if (isSTUNMessage(data)) {
            if (isSTUNBindingResponse(data)) {
                this.log(`[CallRecorder] WASP response received for ${rec.callId}`)
            }
            return
        }

        if (isSRTPPacket(data)) {
            this.handleSRTPPacket(rec, data)
        }
    }

    private handleSRTPPacket(rec: ActiveRecording, packet: Buffer): void {
        if (!rec.sessionKeys || !rec.ffmpegProc?.stdin?.writable) return

        const seq = packet.readUInt16BE(2)
        if (rec.lastSeq >= 0 && seq < rec.lastSeq - 0x8000) {
            rec.rolloverCounter++
        }
        rec.lastSeq = seq

        const opusFrame = decryptSRTPPacket(packet, rec.sessionKeys, rec.rolloverCounter)
        if (!opusFrame || opusFrame.length === 0) return

        rec.packetCount++
        try {
            rec.ffmpegProc.stdin.write(opusFrame)
        } catch { /* FFmpeg closed */ }
    }
}
