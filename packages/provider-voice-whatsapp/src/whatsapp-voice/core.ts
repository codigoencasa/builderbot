/**
 * Core vendor for the WhatsApp voice provider.
 *
 * Manages the per-call state machine, WebRTC peer connections, SDP negotiation,
 * Meta Graph API call control, and the inbound STT / outbound TTS audio pipeline.
 *
 * One instance of this class is created per provider and handles multiple
 * concurrent calls via a `Map<callId, CallSession>`.
 */

import { EventEmitter } from 'node:events'

import { bufferToInt16, chunkPcm, SilenceSegmenter } from '../audio'
import { MetaCallClient } from '../meta-call-client'
import { assertOpus, transformAnswer } from '../sdp'
import { CallState } from '../types'
import type {
    ISttAdapter,
    ITtsAdapter,
    IWhatsAppVoiceProviderArgs,
    WhatsAppCallEntryEvent,
    WhatsAppVoicePayload,
} from '../types'
import { createAudioSink, createAudioSource, createPeerConnection, waitForIceGathering } from '../webrtc'
import type { RTCAudioSinkInstance, RTCAudioSourceInstance } from '../webrtc'

/** Duration of each TTS publish frame in milliseconds. */
const PUBLISH_FRAME_MS = 10

/**
 * Internal representation of a single active call session.
 */
interface CallSession {
    /** Current state in the call state machine. */
    state: CallState
    /** The WebRTC peer connection for this call. */
    pc: RTCPeerConnection
    /** Audio sink attached to the first remote track (receives inbound PCM). */
    sink: RTCAudioSinkInstance | null
    /** Audio source for pushing TTS frames to the remote peer. */
    source: RTCAudioSourceInstance | null
    /** Silence segmenter that detects utterance boundaries. */
    segmenter: SilenceSegmenter
    /** Sample rate negotiated for inbound audio. */
    inboundSampleRate: number
    /** Queues utterance processing to preserve spoken order. */
    utteranceQueue: Promise<void>
    /** E.164 phone number of the caller (e.g. "15551234567"). Used as ctx.from. */
    callerPhone: string
    /** Timer for the paced TTS frame emitter. Null when no playback is active. */
    playbackTimer: ReturnType<typeof setTimeout> | null
    /** Cancels the in-progress playback and resolves its promise (called on hang-up). */
    playbackCancel: (() => void) | null
}

/**
 * Constructor options for `WhatsAppCallCoreVendor`.
 */
export interface WhatsAppCallCoreVendorArgs {
    /** Resolved STT adapter (custom or default OpenAI Whisper). */
    sttAdapter: ISttAdapter
    /** Resolved TTS adapter (custom or OpenAI TTS). */
    ttsAdapter: ITtsAdapter
    /** Provider configuration (for Meta client and silence tuning). */
    config: IWhatsAppVoiceProviderArgs
}

/**
 * Core event-emitting vendor for WhatsApp voice calls.
 *
 * Emitted events:
 * - `'message'` — `WhatsAppVoicePayload` when a caller utterance is transcribed.
 * - `'ready'` — emitted when the vendor is ready (after provider binds).
 * - `'host'` — emitted with host metadata.
 * - `'auth_failure'` — emitted on critical setup failures.
 * - `'notice'` — `{ title: string; instructions: string[] }` for non-fatal warnings.
 *
 * @example
 * const core = new WhatsAppCallCoreVendor({ sttAdapter, ttsAdapter, config })
 * core.on('message', (payload) => console.log(payload.body))
 */
export class WhatsAppCallCoreVendor extends EventEmitter {
    private readonly sessions = new Map<string, CallSession>()
    /** Reverse lookup: callerPhone → callId (for sendMessage routing). */
    private readonly phoneToCallId = new Map<string, string>()
    private readonly metaClient: MetaCallClient
    private readonly sttAdapter: ISttAdapter
    private readonly ttsAdapter: ITtsAdapter
    private readonly config: IWhatsAppVoiceProviderArgs

    constructor(args: WhatsAppCallCoreVendorArgs) {
        super()
        this.sttAdapter = args.sttAdapter
        this.ttsAdapter = args.ttsAdapter
        this.config = args.config

        this.metaClient = new MetaCallClient({
            jwtToken: args.config.jwtToken,
            numberId: args.config.numberId,
            version: args.config.version,
        })
    }

    // ── Inbound call handling ──────────────────────────────────────────────────

    /**
     * Handle an inbound `connect` call event from the Meta webhook.
     *
     * Performs the full call setup sequence:
     * 1. Creates a WebRTC peer connection and sets the remote SDP offer.
     * 2. Creates an SDP answer, transforms it (actpass → active), validates Opus.
     * 3. Sends `pre_accept` to Meta with the SDP answer.
     * 4. Sends `accept` to Meta.
     * 5. Wires the inbound audio pipeline (RTCAudioSink → SilenceSegmenter → STT → message event).
     * 6. Wires ICE state change for `Active` transition.
     *
     * If `pre_accept` fails, `accept` is NOT called and the session is cleaned up.
     * If `accept` fails, a best-effort `end` is sent to Meta before the session is cleaned up.
     *
     * @param event The connect event from the webhook payload.
     * @returns Resolves when the call is accepted and audio pipeline is wired.
     * @throws {Error} On invalid state (duplicate callId) — also emits `notice`.
     */
    public async onConnect(event: WhatsAppCallEntryEvent): Promise<void> {
        const callId = event.id

        // Guard: reject duplicate sessions
        if (this.sessions.has(callId)) {
            this.emit('notice', {
                title: 'WhatsApp Voice: duplicate connect',
                instructions: [`call_id "${callId}" already has an active session — ignoring.`],
            })
            return
        }

        if (!event.session?.sdp) {
            this.emit('notice', {
                title: 'WhatsApp Voice: missing SDP offer',
                instructions: [`connect event for call_id "${callId}" has no session.sdp — cannot answer.`],
            })
            return
        }

        this.emit('notice', {
            title: '[CALL] Inbound call received',
            instructions: [
                `from: ${event.from} | to: ${event.to} | direction: ${event.direction}`,
                `call_id: ${callId}`,
            ],
        })

        const segmenter = new SilenceSegmenter({
            sampleRate: 48000, // wrtc delivers 48kHz; updated on first frame if different
            silenceMs: this.config.silenceMs ?? 800,
            silenceThreshold: this.config.silenceThreshold ?? 0.015,
        })

        // Create session in Idle state first, then immediately transition
        const session: CallSession = {
            state: CallState.Idle,
            pc: createPeerConnection(this.config.iceServers),
            sink: null,
            source: null,
            segmenter,
            inboundSampleRate: 48000,
            utteranceQueue: Promise.resolve(),
            callerPhone: event.from,
            playbackTimer: null,
            playbackCancel: null,
        }
        this.sessions.set(callId, session)
        this.phoneToCallId.set(event.from, callId)

        try {
            // Transition: Idle → Connecting
            this.transitionState(callId, CallState.Idle, CallState.Connecting)

            // Wire ALL WebRTC handlers BEFORE setRemoteDescription so no track or
            // state event is missed. The `track` event in particular fires during
            // setRemoteDescription, so registering ontrack afterwards loses the
            // inbound audio track (no RTCAudioSink → no PCM → no STT).
            session.pc.onconnectionstatechange = () => {
                const state = session.pc.connectionState
                this.emit('notice', {
                    title: `[ICE ] connectionState → ${state}`,
                    instructions: [`call_id: ${callId}`],
                })
                if (state === 'connected') {
                    if (session.state === CallState.Accepted) {
                        this.transitionState(callId, CallState.Accepted, CallState.Active)
                        this.emit('notice', {
                            title: '[ICE ] WebRTC peer connected — call is Active',
                            instructions: [`call_id: ${callId} | from: ${event.from}`],
                        })
                    }
                } else if (state === 'failed' || state === 'closed') {
                    void this.onTerminate(callId)
                }
            }

            // Log ICE connection state changes for diagnostics
            session.pc.oniceconnectionstatechange = () => {
                this.emit('notice', {
                    title: `[ICE ] iceConnectionState → ${session.pc.iceConnectionState}`,
                    instructions: [`call_id: ${callId}`],
                })
            }

            // Log each local ICE candidate type (host / srflx / relay)
            session.pc.onicecandidate = (evt: RTCPeerConnectionIceEvent) => {
                if (evt.candidate) {
                    const typMatch = /typ (\w+)/.exec(evt.candidate.candidate)
                    const typ = typMatch ? typMatch[1] : 'unknown'
                    this.emit('notice', {
                        title: `[ICE ] candidate gathered — typ ${typ}`,
                        instructions: [evt.candidate.candidate.slice(0, 120)],
                    })
                }
            }

            // Wire inbound audio track — fires during setRemoteDescription below
            session.pc.ontrack = (trackEvent: RTCTrackEvent) => {
                if (trackEvent.track.kind !== 'audio') return
                this.emit('notice', {
                    title: '[ICE ] Remote audio track received',
                    instructions: [`call_id: ${callId} | kind: ${trackEvent.track.kind}`],
                })
                this.wireAudioSink(callId, trackEvent.track)
            }

            this.emit('notice', {
                title: '[SDP ] Setting remote SDP offer',
                instructions: [`call_id: ${callId}`],
            })

            // Set remote SDP offer
            await session.pc.setRemoteDescription({
                type: 'offer',
                sdp: event.session.sdp,
            })

            // Create audio source for TTS outbound BEFORE creating answer
            // (so the m-line is included in the answer)
            const audioSource = createAudioSource()
            const outboundTrack = audioSource.createTrack()
            session.pc.addTrack(outboundTrack)
            session.source = audioSource

            this.emit('notice', {
                title: '[SDP ] Creating SDP answer',
                instructions: [`call_id: ${callId}`],
            })

            // Create answer and transform
            const answerDesc = await session.pc.createAnswer()
            const transformedSdp = transformAnswer(answerDesc.sdp ?? '')
            assertOpus(transformedSdp)
            await session.pc.setLocalDescription({ type: 'answer', sdp: transformedSdp })

            this.emit('notice', {
                title: '[SDP ] Answer transformed and validated (Opus)',
                instructions: [`call_id: ${callId}`],
            })

            // Wait for ICE gathering to complete so the SDP includes all candidates.
            // WhatsApp Calling uses non-trickle ICE: candidates must be embedded in the
            // pre_accept SDP. Sending the SDP before gathering is done means Meta gets
            // no candidates and audio never flows.
            this.emit('notice', {
                title: '[ICE ] Gathering ICE candidates…',
                instructions: [`call_id: ${callId} | timeout: ${this.config.iceGatheringTimeoutMs ?? 2000}ms`],
            })
            await waitForIceGathering(session.pc, this.config.iceGatheringTimeoutMs ?? 2000)

            const gatheredSdp = transformAnswer(session.pc.localDescription?.sdp ?? transformedSdp)
            const candidateCount = (gatheredSdp.match(/a=candidate:/g) ?? []).length
            const candidateTypes = [...gatheredSdp.matchAll(/a=candidate:\S+ \d+ \S+ \d+ \S+ \d+ typ (\w+)/g)].map(
                (m) => m[1]
            )
            this.emit('notice', {
                title: `[ICE ] Gathering complete — ${candidateCount} candidate(s)`,
                instructions: [`tipos: ${candidateTypes.join(', ') || 'NINGUNO (posible fallo de STUN/NAT)'}`],
            })

            this.emit('notice', {
                title: '[API ] Sending pre_accept to Meta',
                instructions: [`call_id: ${callId}`],
            })

            // pre_accept: send SDP answer (with embedded ICE candidates) to Meta
            try {
                await this.metaClient.preAccept(callId, gatheredSdp)
            } catch (preAcceptErr) {
                this.emit('notice', {
                    title: 'WhatsApp Voice: pre_accept failed',
                    instructions: [
                        `call_id "${callId}" — pre_accept rejected: ${(preAcceptErr as Error).message}`,
                        'Rejecting call and releasing peer connection.',
                    ],
                })
                // Reject and clean up without calling accept
                try {
                    await this.metaClient.reject(callId)
                } catch {
                    // best-effort
                }
                this.releaseSession(callId)
                return
            }

            this.emit('notice', {
                title: '[API ] pre_accept OK',
                instructions: [`call_id: ${callId}`],
            })

            // Transition: Connecting → PreAccepted
            this.transitionState(callId, CallState.Connecting, CallState.PreAccepted)

            this.emit('notice', {
                title: '[API ] Sending accept to Meta',
                instructions: [`call_id: ${callId}`],
            })

            // accept: finalize call setup — same gathered SDP as pre_accept
            try {
                await this.metaClient.accept(callId, gatheredSdp)
            } catch (acceptErr) {
                this.emit('notice', {
                    title: 'WhatsApp Voice: accept failed',
                    instructions: [
                        `call_id "${callId}" — accept rejected: ${(acceptErr as Error).message}`,
                        'Ending call on Meta and releasing peer connection.',
                    ],
                })
                try {
                    await this.metaClient.end(callId)
                } catch {
                    // best-effort
                }
                this.releaseSession(callId)
                return
            }

            this.emit('notice', {
                title: '[API ] accept OK — call ready',
                instructions: [`call_id: ${callId} | from: ${event.from}`],
            })

            // Transition: PreAccepted → Accepted
            this.transitionState(callId, CallState.PreAccepted, CallState.Accepted)

            // Race condition guard: ICE may have reached 'connected' while the accept
            // HTTP call was in-flight (session.state was PreAccepted then, so the
            // onconnectionstatechange guard skipped the Accepted→Active transition).
            // Check now and drive the state machine forward if needed.
            if (session.pc.connectionState === 'connected') {
                this.transitionState(callId, CallState.Accepted, CallState.Active)
                this.emit('notice', {
                    title: '[ICE ] WebRTC peer connected — call is Active (post-accept check)',
                    instructions: [`call_id: ${callId} | from: ${event.from}`],
                })
            }
        } catch (err) {
            this.emit('notice', {
                title: 'WhatsApp Voice: call setup error',
                instructions: [`call_id "${callId}": ${(err as Error).message}`],
            })
            this.releaseSession(callId)
        }
    }

    /**
     * Handle a `terminate` webhook event for an active or pending call.
     *
     * Closes the peer connection, stops audio tracks, flushes the silence
     * segmenter, and removes the session from the map. If the call_id is
     * unknown, the event is silently ignored.
     *
     * @param callId The call identifier from the webhook.
     */
    public onTerminate(callId: string): void {
        const session = this.sessions.get(callId)
        if (!session) {
            // Unknown call_id — ignore silently per spec FR-6.
            return
        }

        // Flush any partial utterance
        const partial = session.segmenter.flush()
        if (partial) {
            this.enqueueUtterance(session, partial, callId)
        }

        this.releaseSession(callId)

        this.emit('notice', {
            title: 'WhatsApp Voice: call terminated',
            instructions: [`call_id "${callId}" has ended and resources have been released.`],
        })
    }

    // ── Outbound TTS ──────────────────────────────────────────────────────────

    /**
     * Synthesize `text` to speech and transmit it to the caller over the active
     * WebRTC peer connection.
     *
     * @param callId The active call identifier.
     * @param text   The text to synthesize and send.
     * @returns Resolves when all audio frames have been pushed to the peer connection.
     * @throws {Error} Emits `notice` (does not throw) when there is no active call for `callId`.
     */
    public async publishAudio(callIdOrPhone: string, text: string): Promise<void> {
        // Accept either a callId (UUID) or a callerPhone (E.164) — resolve to callId
        const callId = this.sessions.has(callIdOrPhone)
            ? callIdOrPhone
            : (this.phoneToCallId.get(callIdOrPhone) ?? callIdOrPhone)
        const session = this.sessions.get(callId)
        if (!session || !session.source) {
            this.emit('notice', {
                title: 'WhatsApp Voice: no active call',
                instructions: [
                    `publishAudio called for call_id "${callId}" but no active session exists.`,
                    'Ensure sendMessage is only called while a call is active.',
                ],
            })
            return
        }

        this.emit('notice', {
            title: '[TTS ] Publishing audio',
            instructions: [`"${text.length > 80 ? text.slice(0, 80) + '…' : text}" → call_id: ${callId}`],
        })

        const pcm = await this.ttsAdapter.synthesize(text)
        const sampleRate = this.ttsAdapter.sampleRate
        const samplesPerFrame = Math.round((PUBLISH_FRAME_MS / 1000) * sampleRate)
        const frames = chunkPcm(bufferToInt16(pcm), samplesPerFrame, true)

        await this.pushFramesPaced(session, frames, sampleRate)
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Attach an `RTCAudioSink` to a remote audio track and wire the PCM data
     * event into the silence segmenter pipeline.
     *
     * @param callId The call identifier for the session being wired.
     * @param track  The remote audio `MediaStreamTrack`.
     */
    private wireAudioSink(callId: string, track: MediaStreamTrack): void {
        const session = this.sessions.get(callId)
        if (!session) return

        const sink = createAudioSink(track)
        session.sink = sink

        let activeSegmenter = session.segmenter
        // Track the sample rate the current segmenter was built for, so we can
        // rebuild it when the first real frame arrives (wrtc often starts at 48000
        // before settling at 16000) or when the rate changes mid-call.
        let segmenterRate = 48000
        let firstFrame = true

        sink.ondata = ({ samples, sampleRate: rate, channelCount }) => {
            // @roamhq/wrtc emits channelCount (not channels); fall back to 1 (mono).
            const channels = channelCount ?? 1

            if (firstFrame) {
                firstFrame = false
                this.emit('notice', {
                    title: '[PCM ] First inbound audio frame received',
                    instructions: [`call_id: ${callId} | sampleRate: ${rate}Hz | channels: ${channels}`],
                })
            }

            const currentSession = this.sessions.get(callId)
            if (!currentSession) {
                sink.stop()
                return
            }

            // Rebuild segmenter when the actual rate differs from the rate the
            // current segmenter was configured for (covers first-frame rate mismatch
            // and mid-call rate changes).
            if (rate !== segmenterRate) {
                const partial = activeSegmenter.flush()
                if (partial) this.enqueueUtterance(currentSession, partial, callId)
                activeSegmenter = new SilenceSegmenter({
                    sampleRate: rate,
                    silenceMs: this.config.silenceMs ?? 800,
                    silenceThreshold: this.config.silenceThreshold ?? 0.015,
                })
                currentSession.segmenter = activeSegmenter
                segmenterRate = rate
            }

            currentSession.inboundSampleRate = rate

            const mono = this.toMono(samples, channels)
            const utterance = activeSegmenter.push(mono)
            if (utterance) {
                this.enqueueUtterance(currentSession, utterance, callId)
            }
        }
    }

    /**
     * Queue an utterance for transcription in order, serializing concurrent calls.
     *
     * @param session   The call session that produced the utterance.
     * @param pcm       Raw 16-bit LE mono PCM buffer.
     * @param callId    The call identifier (for the emitted payload).
     */
    private enqueueUtterance(session: CallSession, pcm: Buffer, callId: string): void {
        session.utteranceQueue = session.utteranceQueue.then(() =>
            this.handleUtterance(pcm, session.inboundSampleRate, callId)
        )
    }

    /**
     * Transcribe a PCM utterance and emit a `message` event.
     *
     * @param pcm        Raw 16-bit LE mono PCM.
     * @param sampleRate Sample rate of the PCM in Hz.
     * @param callId     Call identifier used as the `from` field in the payload.
     */
    private async handleUtterance(pcm: Buffer, sampleRate: number, callId: string): Promise<void> {
        try {
            const body = await this.sttAdapter.transcribe(pcm, sampleRate, this.config.language)
            if (!body || body.trim() === '') return

            const session = this.sessions.get(callId)
            const callerPhone = session?.callerPhone ?? callId

            this.emit('notice', {
                title: '[STT ] Utterance transcribed',
                instructions: [`"${body.trim()}" from ${callerPhone}`],
            })

            const payload: WhatsAppVoicePayload = {
                body: body.trim(),
                from: callerPhone,
                name: callerPhone,
                audio: pcm,
                sampleRate,
            }
            this.emit('message', payload)
        } catch (err) {
            this.emit('notice', {
                title: 'WhatsApp Voice: transcription error',
                instructions: [`call_id "${callId}": ${(err as Error).message}`],
            })
        }
    }

    /**
     * Transition the call state machine.
     *
     * Throws and emits `notice` on invalid transitions (e.g. `accept` while `Connecting`).
     *
     * @param callId   The call identifier.
     * @param from     Expected current state.
     * @param to       Target state.
     * @throws {Error} When the current state does not match `from`.
     */
    private transitionState(callId: string, from: CallState, to: CallState): void {
        const session = this.sessions.get(callId)
        if (!session) return

        if (session.state !== from) {
            const msg =
                `[WhatsAppCallCoreVendor] Invalid state transition for call_id "${callId}": ` +
                `expected ${from}, got ${session.state}. Attempted transition to ${to}.`
            this.emit('notice', {
                title: 'WhatsApp Voice: invalid state transition',
                instructions: [msg],
            })
            throw new Error(msg)
        }

        session.state = to
    }

    /**
     * Emit PCM frames to the RTCAudioSource at wall-clock cadence (one frame per
     * PUBLISH_FRAME_MS), scheduling each tick against an absolute deadline to
     * prevent accumulated drift. Resolves when all frames have been sent or the
     * session is cancelled / terminated.
     */
    private pushFramesPaced(session: CallSession, frames: Int16Array[], sampleRate: number): Promise<void> {
        return new Promise<void>((resolve) => {
            let i = 0
            const startTime = Date.now()

            const finish = () => {
                if (session.playbackTimer) {
                    clearTimeout(session.playbackTimer)
                    session.playbackTimer = null
                }
                session.playbackCancel = null
                resolve()
            }

            session.playbackCancel = finish

            const tick = () => {
                if (!session.source || session.state === CallState.Terminated) {
                    finish()
                    return
                }
                const frame = frames[i]
                session.source.onData({
                    samples: frame,
                    sampleRate,
                    bitsPerSample: 16,
                    channelCount: 1,
                    numberOfFrames: frame.length,
                })
                i++
                if (i >= frames.length) {
                    finish()
                    return
                }
                // Absolute deadline for the next frame — self-corrects for drift.
                const nextDeadline = startTime + i * PUBLISH_FRAME_MS
                const delay = Math.max(0, nextDeadline - Date.now())
                session.playbackTimer = setTimeout(tick, delay)
            }

            tick()
        })
    }

    /**
     * Release all resources for a call session and remove it from the map.
     *
     * Safe to call in any state — closes the peer connection, stops sink,
     * and removes the session entry.
     *
     * @param callId The call identifier to release.
     */
    private releaseSession(callId: string): void {
        const session = this.sessions.get(callId)
        if (!session) return

        if (session.playbackCancel) {
            session.playbackCancel()
        }

        try {
            if (session.sink) {
                session.sink.stop()
            }
        } catch {
            // ignore sink stop errors
        }

        try {
            session.pc.close()
        } catch {
            // ignore PC close errors
        }

        session.state = CallState.Terminated
        this.phoneToCallId.delete(session.callerPhone)
        this.sessions.delete(callId)
    }

    /**
     * Mix a multi-channel PCM frame down to mono by averaging all channels.
     *
     * @param data     Raw interleaved PCM samples.
     * @param channels Number of channels in `data`.
     * @returns Mono Int16Array.
     */
    private toMono(data: Int16Array, channels: number): Int16Array {
        if (!channels || channels <= 1) return data
        const frames = Math.floor(data.length / channels)
        const mono = new Int16Array(frames)
        for (let i = 0; i < frames; i++) {
            let sum = 0
            for (let c = 0; c < channels; c++) {
                sum += data[i * channels + c]
            }
            mono[i] = Math.round(sum / channels)
        }
        return mono
    }
}
