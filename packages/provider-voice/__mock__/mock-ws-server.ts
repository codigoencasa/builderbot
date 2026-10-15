/**
 * Minimal WebSocket server for tests: no dependencies, no external network.
 *
 * Only implements what the TTS adapter tests need: handshake, reading masked text
 * frames from the client and sending text frames back. It is not a complete
 * WebSocket server (no binary frames, no ping/pong, no fragmentation).
 */
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import type { IncomingMessage, Server } from 'node:http'
import type { Socket } from 'node:net'

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

export interface MockSocketServer {
    url: string
    /** Handshake headers sent by the client (to assert authentication). */
    headers: () => IncomingMessage['headers']
    /** JSON messages received from the client, in order. */
    received: () => unknown[]
    /** Send an object as a text frame. */
    send: (payload: unknown) => void
    /** Close the connection cleanly (close frame, code 1000). */
    close: () => void
    /** Drop the connection without closing (simulates a network failure). */
    destroy: () => void
    /** Stop the server and release the port. */
    stop: () => Promise<void>
}

const encodeFrame = (text: string): Buffer => {
    const payload = Buffer.from(text, 'utf8')
    if (payload.length < 126) {
        return Buffer.concat([Buffer.from([0x81, payload.length]), payload])
    }
    const header = Buffer.alloc(4)
    header[0] = 0x81
    header[1] = 126
    header.writeUInt16BE(payload.length, 2)
    return Buffer.concat([header, payload])
}

const decodeFrames = (buffer: Buffer): { messages: string[]; rest: Buffer } => {
    const messages: string[] = []
    let offset = 0
    while (buffer.length - offset >= 2) {
        const opcode = buffer[offset] & 0x0f
        const masked = (buffer[offset + 1] & 0x80) !== 0
        let length = buffer[offset + 1] & 0x7f
        let cursor = offset + 2
        if (length === 126) {
            if (buffer.length - cursor < 2) break
            length = (buffer as Buffer).readUInt16BE(cursor)
            cursor += 2
        } else if (length === 127) {
            if (buffer.length - cursor < 8) break
            length = Number((buffer as Buffer).readBigUInt64BE(cursor))
            cursor += 8
        }
        const maskKey = masked ? Uint8Array.from(buffer.subarray(cursor, cursor + 4)) : null
        if (masked) cursor += 4
        if (buffer.length - cursor < length) break
        const payload = Uint8Array.from(buffer.subarray(cursor, cursor + length))
        if (maskKey) for (let i = 0; i < payload.length; i++) payload[i] ^= maskKey[i % 4]
        if (opcode === 1) messages.push(new TextDecoder().decode(payload))
        offset = cursor + length
    }
    return { messages, rest: Buffer.from(buffer.subarray(offset)) }
}

export const startMockSocketServer = async (): Promise<MockSocketServer> => {
    const received: unknown[] = []
    let clientHeaders: IncomingMessage['headers'] = {}
    const sockets = new Set<Socket>()
    let active: Socket | null = null

    const server: Server = createServer()
    server.on('upgrade', (req, socket: Socket) => {
        clientHeaders = req.headers
        const key = req.headers['sec-websocket-key'] ?? ''
        const accept = createHash('sha1').update(`${key}${GUID}`).digest('base64')
        socket.write(
            'HTTP/1.1 101 Switching Protocols\r\n' +
                'Upgrade: websocket\r\n' +
                'Connection: Upgrade\r\n' +
                `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
        )
        sockets.add(socket)
        active = socket
        let pending: Buffer = Buffer.alloc(0)
        socket.on('data', (chunk: Buffer) => {
            pending = Buffer.concat([pending, chunk]) as Buffer
            const { messages, rest } = decodeFrames(pending)
            pending = rest
            for (const message of messages) {
                try {
                    received.push(JSON.parse(message))
                } catch {
                    received.push(message)
                }
            }
        })
        socket.on('close', () => sockets.delete(socket))
        socket.on('error', () => sockets.delete(socket))
    })

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0

    return {
        url: `ws://127.0.0.1:${port}/tts/v1/voice:streamBidirectional`,
        headers: () => clientHeaders,
        received: () => received,
        send: (payload) => active?.write(encodeFrame(JSON.stringify(payload))),
        close: () => {
            // Close frame with code 1000: the client gets onclose without an error.
            active?.write(Buffer.from([0x88, 0x02, 0x03, 0xe8]))
            const socket = active
            setTimeout(() => socket?.destroy(), 50)
        },
        destroy: () => active?.destroy(),
        stop: async () => {
            for (const socket of sockets) socket.destroy()
            await new Promise<void>((resolve) => server.close(() => resolve()))
        },
    }
}
