/**
 * Thin wrapper around `@roamhq/wrtc` that exposes typed helpers for WebRTC
 * peer connection management and audio I/O.
 *
 * All WebRTC interactions in the provider go through this module so the
 * underlying native binding can be swapped in tests without touching core logic.
 */

const wrtc = require('@roamhq/wrtc') as {
    RTCPeerConnection: typeof RTCPeerConnection
    RTCAudioSink: new (track: MediaStreamTrack) => RTCAudioSinkInstance
    RTCAudioSource: new () => RTCAudioSourceInstance
    nonstandard: {
        RTCAudioSink: new (track: MediaStreamTrack) => RTCAudioSinkInstance
        RTCAudioSource: new () => RTCAudioSourceInstance
    }
}

// ── Audio sink / source type definitions ────────────────────────────────────

/**
 * Data payload received from an `RTCAudioSink` data event.
 *
 * Each event delivers one 10ms PCM frame captured from the remote audio track.
 */
export interface AudioSinkData {
    /** 16-bit signed little-endian PCM samples. */
    samples: Int16Array
    /** Sample rate of the audio in Hz (typically 48000 for WebRTC). */
    sampleRate: number
    /** Number of audio channels (1 = mono, 2 = stereo). @roamhq/wrtc emits this as `channelCount`. */
    channelCount: number
    /** Total number of frames in this chunk. */
    numberOfFrames: number
    /** Width of each sample in bits (always 16). */
    bitsPerSample: number
}

/**
 * Typed interface for the `@roamhq/wrtc` nonstandard `RTCAudioSink`.
 *
 * Attach a `data` listener to receive raw PCM frames from a remote audio track.
 */
export interface RTCAudioSinkInstance {
    /**
     * Callback invoked with each incoming PCM frame.
     * @param data The audio frame data from the remote track.
     */
    ondata: ((data: AudioSinkData) => void) | null
    /** Stop the sink and detach from the track. */
    stop(): void
}

/**
 * Typed interface for the `@roamhq/wrtc` nonstandard `RTCAudioSource`.
 *
 * Push PCM frames into this source to transmit audio to the remote peer.
 */
export interface RTCAudioSourceInstance {
    /**
     * Create a `MediaStreamTrack` that wraps this source.
     * @returns A `MediaStreamTrack` suitable for adding to a peer connection.
     */
    createTrack(): MediaStreamTrack
    /**
     * Push one 10ms PCM frame to the remote peer.
     * @param data The audio frame data to send.
     */
    onData(data: {
        samples: Int16Array
        sampleRate: number
        bitsPerSample: number
        channelCount: number
        numberOfFrames: number
    }): void
}

// ── Default ICE configuration ─────────────────────────────────────────────────

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
]

// ── Factory helpers ───────────────────────────────────────────────────────────

/**
 * Create a new WebRTC peer connection pre-configured with STUN servers.
 *
 * Uses `@roamhq/wrtc` for native Node.js WebRTC support including
 * darwin-arm64 prebuilt binaries for Node 18/20/22.
 *
 * @param iceServers Optional ICE server configuration. Defaults to Google's public STUN servers.
 * @returns A new `RTCPeerConnection` instance ready for offer/answer negotiation.
 *
 * @example
 * const pc = createPeerConnection()
 * await pc.setRemoteDescription({ type: 'offer', sdp: offer })
 * const answer = await pc.createAnswer()
 */
export const createPeerConnection = (iceServers?: RTCIceServer[]): RTCPeerConnection => {
    return new wrtc.RTCPeerConnection({
        iceServers: iceServers ?? DEFAULT_ICE_SERVERS,
    })
}

/**
 * Create a new `RTCAudioSink` attached to a remote audio track.
 *
 * Use the `ondata` callback to receive raw PCM frames from the caller.
 *
 * @param track The remote `MediaStreamTrack` to sink audio from.
 * @returns An `RTCAudioSinkInstance` with an `ondata` callback.
 *
 * @example
 * const sink = createAudioSink(remoteTrack)
 * sink.ondata = ({ samples, sampleRate, channels }) => {
 *   const mono = toMono(samples, channels)
 *   segmenter.push(mono)
 * }
 */
export const createAudioSink = (track: MediaStreamTrack): RTCAudioSinkInstance => {
    return new wrtc.nonstandard.RTCAudioSink(track)
}

/**
 * Wait until the RTCPeerConnection finishes ICE gathering.
 *
 * WhatsApp Calling uses non-trickle ICE: all candidates must be embedded in the
 * SDP sent to Meta via `pre_accept`. This helper blocks until `iceGatheringState`
 * reaches `"complete"` or the timeout fires (whichever comes first).
 *
 * @param pc        The peer connection to wait on.
 * @param timeoutMs Maximum wait in milliseconds before giving up. Default: 2000.
 * @returns Resolves when gathering is complete or timed out.
 */
export const waitForIceGathering = (pc: RTCPeerConnection, timeoutMs = 2000): Promise<void> => {
    if (pc.iceGatheringState === 'complete') return Promise.resolve()
    return new Promise<void>((resolve) => {
        const prev = pc.onicegatheringstatechange
        const done = () => {
            clearTimeout(timer)
            pc.onicegatheringstatechange = prev
            resolve()
        }
        const timer = setTimeout(done, timeoutMs)
        pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') done()
        }
    })
}

/**
 * Create a new `RTCAudioSource` for pushing TTS audio to the remote peer.
 *
 * Call `createTrack()` to obtain a `MediaStreamTrack` and add it to the peer
 * connection before creating the answer.
 *
 * @returns An `RTCAudioSourceInstance` with an `onData` push method.
 *
 * @example
 * const source = createAudioSource()
 * const track = source.createTrack()
 * pc.addTrack(track)
 */
export const createAudioSource = (): RTCAudioSourceInstance => {
    return new wrtc.nonstandard.RTCAudioSource()
}
