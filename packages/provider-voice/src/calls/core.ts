/**
 * LAYER: Infrastructure
 * Contains: MetaCallCoreVendorArgs, SilenceSegmenter, MetaCallClient, CallState
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(n^2) score:1
 * keywords: [MetaCallCoreVendorArgs, SilenceSegmenter, MetaCallClient, CallState]
 * GOAL: Own the "core" concern of the provider-voice package.
 */
/**
 * Core vendor for handling Meta (WhatsApp Business) voice calls.
 *
 * Manages the per-call state machine, WebRTC peer connections, SDP negotiation,
 * Meta Graph API call control, and the inbound STT / outbound TTS audio pipeline.
 *
 * One instance of this class is created per provider and handles multiple
 * concurrent calls via a `Map<callId, CallSession>`. Shared between
 * `@builderbot/provider-voice-whatsapp` and `@builderbot/provider-meta` (when
 * voice calls are enabled).
 */

import { EventEmitter } from 'node:events'

import { bufferToInt16, chunkPcm, SilenceSegmenter } from '../audio'
import { abortable } from './abortable'
import { MetaCallClient } from './meta-call-client'
import { assertOpus, transformAnswer } from './sdp'
import { CallState } from './types'
import type {
    CallActiveEvent,
    CallEndedEvent,
    IMetaCallCoreConfig,
    ISttAdapter,
    ITtsAdapter,
    PlaybackInterruptedEvent,
    WhatsAppCallEntryEvent,
    WhatsAppVoicePayload,
} from './types'
import { createAudioSink, createAudioSource, createPeerConnection, waitForIceGathering } from './webrtc'
import type { RTCAudioSinkInstance, RTCAudioSourceInstance } from './webrtc'

/** Duration of each TTS publish frame in milliseconds. */
const PUBLISH_FRAME_MS = 10

/** Concatenate Int16 chunks (streamed synthesis arrives in arbitrary sizes). */
const concatInt16 = (chunks: Int16Array[]): Int16Array => {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const out = new Int16Array(total)
    let offset = 0
    for (const chunk of chunks) {
        out.set(chunk, offset)
        offset += chunk.length
    }
    return out
}

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
    /** Explicitly stopped on release; closing a peer alone need not stop its local track. */
    outboundTrack?: MediaStreamTrack
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
    /** Diagnóstico: tramas entrantes y utterances transcritas (se informan al colgar). */
    inboundFrames: number
    utterances: number
    /** Cancels the in-progress playback and resolves its promise (called on hang-up). */
    playbackCancel: (() => void) | null
    /** Serialize output for this call; never overwrite another publisher's timer. */
    outputQueue: Promise<void>
    /** Includes queued requests and synthesis, not only audio already playing. */
    outputControllers: Set<AbortController>
}

/**
 * Constructor options for `MetaCallCoreVendor`.
 */
export interface MetaCallCoreVendorArgs {
    /** Resolved STT adapter (custom or default OpenAI Whisper). */
    sttAdapter: ISttAdapter
    /** Resolved TTS adapter (custom or OpenAI TTS). */
    ttsAdapter: ITtsAdapter
    /** Call configuration (Meta client credentials and silence tuning). */
    config: IMetaCallCoreConfig
}

/**
 * Core event-emitting vendor for Meta (WhatsApp Business) voice calls.
 *
 * Emitted events:
 * - `'message'` — `WhatsAppVoicePayload` when a caller utterance is transcribed.
 * - `'ready'` — emitted when the vendor is ready (after provider binds).
 * - `'host'` — emitted with host metadata.
 * - `'auth_failure'` — emitted on critical setup failures.
 * - `'notice'` — `{ title: string; instructions: string[] }` for non-fatal warnings.
 *
 * @example
 * const core = new MetaCallCoreVendor({ sttAdapter, ttsAdapter, config })
 * core.on('message', (payload) => console.log(payload.body))
 */
export class MetaCallCoreVendor extends EventEmitter {
    private readonly sessions = new Map<string, CallSession>()
    /** Reverse lookup: callerPhone → callId (for sendMessage routing). */
    private readonly phoneToCallId = new Map<string, string>()
    private readonly metaClient: MetaCallClient
    private readonly sttAdapter: ISttAdapter
    private readonly ttsAdapter: ITtsAdapter
    private readonly config: IMetaCallCoreConfig
    /** Set by {@link shutdown}: new inbound calls are rejected instead of accepted. */
    private closing = false
    /** Avoids repeating the audio-processor warning on every frame. */
    private audioProcessorWarned = false
    /** Milisegundos hasta el primer frame enviado (se reinicia en cada publicación). */
    private firstFrameAt: number | null = null

    constructor(args: MetaCallCoreVendorArgs) {
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

        // Guard: never accept a call while shutting down; reject it so the caller is not left ringing.
        if (this.closing) {
            this.emit('notice', {
                title: 'WhatsApp Voice: rejecting call during shutdown',
                instructions: [`call_id "${callId}"`],
            })
            try {
                await this.metaClient.reject(callId)
            } catch {
                // best-effort
            }
            return
        }

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
            onSpeechStart: this.bargeInHandler(callId),
            minSpeechMs: this.config.bargeInMinSpeechMs ?? 120,
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
            inboundFrames: 0,
            utterances: 0,
            outputQueue: Promise.resolve(),
            outputControllers: new Set(),
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
                        this.activateCall(callId, event)
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
            session.outboundTrack = outboundTrack
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

            // Race guard: the caller may have hung up (terminate webhook) while
            // the SDP/ICE work above was in flight. If the session is gone, do
            // not send pre_accept for a call Meta already considers terminated.
            if (!this.sessions.has(callId)) return

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

            // Race guard: a terminate that arrived while pre_accept was in flight
            // already released the session — never send accept for a dead call.
            if (!this.sessions.has(callId)) return

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

            if (this.sessions.get(callId) !== session) return

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
                this.activateCall(callId, event)
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

        // Discard partial audio: hang-up must not start new STT/flow work.
        session.segmenter.flush()

        const endedEvent: CallEndedEvent = { callId, from: session.callerPhone }

        this.releaseSession(callId)

        this.emit('notice', {
            title: 'WhatsApp Voice: call terminated',
            instructions: [
                `call_id "${callId}" has ended and resources have been released.`,
                `audio entrante: ${session.inboundFrames} tramas | utterances: ${session.utterances}`,
            ],
        })

        this.emit('call_ended', endedEvent)
    }

    /**
     * Hang up every call and release all native resources (graceful shutdown).
     *
     * For each session: cancel pending output, ask Meta to `terminate` the call
     * (best-effort, bounded by `timeoutMs` so a slow Graph API cannot block the
     * shutdown), then release it exactly like a `terminate` webhook, emitting
     * `call_ended`. Sessions are released even if Meta rejects or times out.
     *
     * Call this from SIGINT/SIGTERM handlers before exiting. Exit with
     * `process.exit()` afterwards: `@roamhq/wrtc` 0.10.0 can crash during a
     * *natural* process exit while finalizing native objects
     * (WonderInventions/node-webrtc#54); an explicit exit skips that path.
     *
     * @param timeoutMs Max wait for Meta `terminate` requests. Default 3000.
     * @returns Number of calls that were active when shutdown started.
     */
    public async shutdown(timeoutMs = 3000): Promise<number> {
        this.closing = true
        const callIds = [...this.sessions.keys()]
        for (const callId of callIds) this.cancelResponse(callId)
        const hangups = callIds.map(async (callId) => {
            try {
                await this.metaClient.end(callId)
            } catch (err) {
                this.emit('notice', {
                    title: 'WhatsApp Voice: terminate on shutdown failed',
                    instructions: [`call_id "${callId}": ${(err as Error).message}`],
                })
            }
        })
        let timer: ReturnType<typeof setTimeout> | undefined
        const timeout = new Promise<void>((resolve) => {
            timer = setTimeout(resolve, timeoutMs)
        })
        try {
            await Promise.race([Promise.all(hangups), timeout])
        } finally {
            clearTimeout(timer)
        }
        for (const callId of callIds) this.onTerminate(callId)
        return callIds.length
    }

    /**
     * Drive the `Accepted → Active` transition and announce the call.
     *
     * Emits the `call_active` event (so consumers can greet the caller or log
     * the call), emits the diagnostic notice and, when `greetingMessage` is
     * configured, speaks it to the caller.
     *
     * Called from both the ICE `connected` handler and the post-accept check so
     * the event fires exactly once per call, and only once the media path is
     * open (audio sent before that is not heard).
     *
     * @param callId The call identifier.
     * @param event  The original `connect` webhook event.
     */
    private activateCall(callId: string, event: WhatsAppCallEntryEvent): void {
        const session = this.sessions.get(callId)
        if (!session) return

        this.transitionState(callId, CallState.Accepted, CallState.Active)

        this.emit('notice', {
            title: '[ICE ] WebRTC peer connected — call is Active',
            instructions: [`call_id: ${callId} | from: ${event.from}`],
        })

        const activeEvent: CallActiveEvent = {
            callId,
            from: event.from,
            to: event.to,
            direction: event.direction,
        }
        this.emit('call_active', activeEvent)

        if (this.config.greetingMessage) {
            void this.publishAudio(callId, this.config.greetingMessage).catch((err: Error) => {
                this.emit('notice', {
                    title: 'WhatsApp Voice: greeting failed',
                    instructions: [`call_id "${callId}": ${err.message}`],
                })
            })
        }
    }

    // ── Session lookup ────────────────────────────────────────────────────────

    /**
     * Check whether `callIdOrPhone` (a call_id or the caller's E.164 phone
     * number) has an active call session right now.
     *
     * Useful for callers (e.g. `provider-meta`'s `sendMessage`) that need to
     * decide whether to route a reply to `publishAudio` (voice) or to a
     * regular WhatsApp message.
     *
     * @param callIdOrPhone A call_id or the caller's phone number.
     * @returns `true` when a session exists for the given identifier.
     */
    public hasActiveCall(callIdOrPhone: string): boolean {
        return this.sessions.has(callIdOrPhone) || this.phoneToCallId.has(callIdOrPhone)
    }

    /**
     * Resolve the active call_id for a given caller phone number.
     *
     * @param phone The caller's E.164 phone number.
     * @returns The active call_id, or `undefined` when no call is active for that phone.
     */
    public getActiveCallId(phone: string): string | undefined {
        if (this.sessions.has(phone)) return phone
        return this.phoneToCallId.get(phone)
    }

    // ── Outbound TTS ──────────────────────────────────────────────────────────

    /**
     * Synthesize `text` to speech and transmit it to the caller over the active
     * WebRTC peer connection.
     *
     * @param callIdOrPhone The active call identifier, or the caller's phone number.
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

        const controller = new AbortController()
        session.outputControllers.add(controller)
        this.firstFrameAt = null
        const publish = session.outputQueue.then(async () => {
            if (controller.signal.aborted || this.sessions.get(callId) !== session) return
            try {
                const sampleRate = this.ttsAdapter.sampleRate
                const options = { signal: controller.signal, callId }
                // Streaming adapter: start playing with the first chunk instead of waiting
                // for the whole sentence. Playback pacing stays the same either way.
                if (this.ttsAdapter.synthesizeStream) {
                    const stream = this.ttsAdapter.synthesizeStream(text, options)
                    await this.pushStreamPaced(session, stream, sampleRate)
                    return
                }
                const pcm = await abortable(this.ttsAdapter.synthesize(text, options), controller.signal)
                // A non-cancellable adapter can finish after interruption/hang-up.
                if (controller.signal.aborted || this.sessions.get(callId) !== session || !pcm.length) return
                const samplesPerFrame = Math.round((PUBLISH_FRAME_MS / 1000) * sampleRate)
                const frames = chunkPcm(bufferToInt16(pcm), samplesPerFrame, true)
                await this.pushFramesPaced(session, frames, sampleRate)
            } catch (err) {
                if (!controller.signal.aborted) throw err
            }
        })
        // A failed synthesis must not poison the next response in this call.
        session.outputQueue = publish.catch(() => {})
        try {
            await publish
        } finally {
            session.outputControllers.delete(controller)
        }
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
                    onSpeechStart: this.bargeInHandler(callId),
                    minSpeechMs: this.config.bargeInMinSpeechMs ?? 120,
                })
                currentSession.segmenter = activeSegmenter
                segmenterRate = rate
            }

            currentSession.inboundSampleRate = rate
            currentSession.inboundFrames++

            const mono = this.toMono(samples, channels)
            // Echo control runs before speech detection so the bot does not cut itself off.
            const clean = this.cleanInboundFrame(mono, rate)
            const utterance = activeSegmenter.push(clean)
            if (utterance) {
                this.enqueueUtterance(currentSession, utterance, callId)
            }
        }
    }

    /**
     * Build the `onSpeechStart` handler for a call.
     *
     * Barge-in is on by default (`config.bargeIn`); when disabled the handler is
     * `undefined` so the segmenter does no extra work.
     *
     * @param callId The call the segmenter belongs to.
     * @returns A callback that cuts the bot's playback, or `undefined`.
     */
    private bargeInHandler(callId: string): (() => void) | undefined {
        if (this.config.bargeIn === false) return undefined
        return () => {
            const session = this.sessions.get(callId)
            if (!session) return
            // Flows must also cancel a response still waiting for its first LLM token.
            this.emit('user_speech_started', { callId, from: session.callerPhone })
            this.interruptPlayback(callId)
        }
    }

    /**
     * Cut the bot's current playback because the caller started talking.
     *
     * No-op when nothing is playing (e.g. the caller replies after the bot has
     * finished). Emits `playback_interrupted` so flows can react.
     *
     * @param callId The call whose playback should stop.
     */
    private interruptPlayback(callId: string): void {
        const session = this.sessions.get(callId)
        if (!session?.outputControllers.size) return

        this.cancelResponse(callId)

        this.emit('notice', {
            title: '[BARGE] playback interrupted',
            instructions: [`call_id: ${callId} | from: ${session.callerPhone}`],
        })

        const payload: PlaybackInterruptedEvent = { callId, from: session.callerPhone }
        this.emit('playback_interrupted', payload)
    }

    /** Cancel queued synthesis and playback for one call. Safe to call repeatedly. */
    public cancelResponse(callIdOrPhone: string): void {
        const callId = this.getActiveCallId(callIdOrPhone)
        const session = callId && this.sessions.get(callId)
        if (!session) return
        for (const controller of session.outputControllers) controller.abort()
        session.playbackCancel?.()
    }

    /**
     * Queue an utterance for transcription in order, independently for each call.
     *
     * @param session   The call session that produced the utterance.
     * @param pcm       Raw 16-bit LE mono PCM buffer.
     * @param callId    The call identifier (for the emitted payload).
     */
    private enqueueUtterance(session: CallSession, pcm: Buffer, callId: string): void {
        session.utterances++
        // Capture the rate now: queued PCM must not inherit a later rate change.
        const sampleRate = session.inboundSampleRate
        session.utteranceQueue = session.utteranceQueue.then(async () => {
            if (this.sessions.get(callId) !== session) return
            await this.handleUtterance(pcm, sampleRate, callId)
        })
    }

    /**
     * Transcribe a PCM utterance and emit a `message` event.
     *
     * @param pcm        Raw 16-bit LE mono PCM.
     * @param sampleRate Sample rate of the PCM in Hz.
     * @param callId     Call identifier used as the `from` field in the payload.
     */
    private async handleUtterance(pcm: Buffer, sampleRate: number, callId: string): Promise<void> {
        const session = this.sessions.get(callId)
        if (!session) return
        try {
            // Con timeout: las utterances se procesan en orden, así que una llamada de STT
            // que no vuelve deja al cliente sin ser oído el resto de la llamada.
            const body = await this.withTimeout(
                this.sttAdapter.transcribe(pcm, sampleRate, this.config.language),
                this.config.sttTimeoutMs ?? 10000,
                'STT'
            )
            if (this.sessions.get(callId) !== session || !body || body.trim() === '') return

            const callerPhone = session.callerPhone

            this.emit('notice', {
                title: '[STT ] Utterance transcribed',
                instructions: [`"${body.trim()}" from ${callerPhone}`],
            })

            const payload: WhatsAppVoicePayload = {
                callId,
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
                `[MetaCallCoreVendor] Invalid state transition for call_id "${callId}": ` +
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
    /** Await `promise` but give up after `timeoutMs`, so one slow call cannot stall a queue. */
    private withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
        let timer: ReturnType<typeof setTimeout> | undefined
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs)
        })
        return Promise.race([promise, timeout]).finally(() => {
            if (timer) clearTimeout(timer)
        })
    }

    /** Feed the echo reference. Never lets a failing processor break playback. */
    private notifyOutboundFrame(frame: Int16Array, sampleRate: number): void {
        try {
            this.config.audioProcessor?.onOutboundFrame?.(frame, sampleRate)
        } catch (err) {
            this.warnAudioProcessor(err)
        }
    }

    /** Cleaned microphone frame, or the raw frame if the processor is missing or fails. */
    private cleanInboundFrame(frame: Int16Array, sampleRate: number): Int16Array {
        const processor = this.config.audioProcessor
        if (!processor?.processInboundFrame) return frame
        try {
            const clean = processor.processInboundFrame(frame, sampleRate)
            return clean?.length === frame.length ? clean : frame
        } catch (err) {
            this.warnAudioProcessor(err)
            return frame
        }
    }

    /** One warning per call: a broken processor must not flood the logs frame by frame. */
    private warnAudioProcessor(err: unknown): void {
        if (this.audioProcessorWarned) return
        this.audioProcessorWarned = true
        this.emit('notice', {
            title: 'WhatsApp Voice: audio processor error',
            instructions: [
                `${(err as Error).message}`,
                'Echo control disabled for this process; inbound audio is used unchanged.',
            ],
        })
    }

    /**
     * Play a streamed synthesis while it is still being generated.
     *
     * Chunks are re-framed to PUBLISH_FRAME_MS and emitted at wall-clock cadence, so a
     * fast producer cannot push audio faster than real time and a slow one simply
     * underruns (the next tick waits). Resolves when the last frame was sent, the
     * session ended, or playback was cancelled.
     */
    private pushStreamPaced(session: CallSession, chunks: AsyncIterable<Buffer>, sampleRate: number): Promise<void> {
        const started = Date.now()
        const samplesPerFrame = Math.max(1, Math.round((PUBLISH_FRAME_MS / 1000) * sampleRate))
        const queue: Int16Array[] = []
        let remainder = new Int16Array(0)
        let producerDone = false
        let failure: Error | null = null
        let wake: (() => void) | null = null
        /** Lo asigna el reproductor: liquida si el productor terminó y no queda nada por sonar. */
        let settleWhenIdle: (() => void) | null = null
        const notify = () => {
            wake?.()
            wake = null
        }

        const iterator = chunks[Symbol.asyncIterator]()
        const producer = (async () => {
            try {
                while (true) {
                    const { value: chunk, done } = await iterator.next()
                    if (done) break
                    if (session.state === CallState.Terminated) return
                    const pcm = bufferToInt16(chunk)
                    if (!pcm.length) continue
                    const all = remainder.length ? concatInt16([remainder, pcm]) : pcm
                    let offset = 0
                    while (all.length - offset >= samplesPerFrame) {
                        queue.push(all.slice(offset, offset + samplesPerFrame))
                        offset += samplesPerFrame
                    }
                    remainder = all.slice(offset)
                    notify()
                }
                if (remainder.length) {
                    const last = new Int16Array(samplesPerFrame)
                    last.set(remainder)
                    queue.push(last)
                    remainder = new Int16Array(0)
                }
            } catch (err) {
                failure = err as Error
            } finally {
                producerDone = true
                notify()
                // No esperar al siguiente tick si ya no queda audio pendiente: un stream
                // vacío o que termina justo al vaciarse la cola debe resolver de inmediato.
                settleWhenIdle?.()
            }
        })()

        return new Promise<void>((resolve, reject) => {
            let settled = false
            const finish = (err?: Error) => {
                if (settled) return
                settled = true
                if (session.playbackTimer) {
                    clearTimeout(session.playbackTimer)
                    session.playbackTimer = null
                }
                session.playbackCancel = null
                // Close the source stream: a cancelled turn must stop generating audio.
                void iterator.return?.(undefined).catch(() => {})
                if (err) reject(err)
                else resolve()
            }
            session.playbackCancel = () => finish()
            settleWhenIdle = () => {
                if (settled || queue.length) return
                if (failure) finish(failure)
                else finish()
            }

            let deadline = Date.now()
            const tick = () => {
                if (settled) return
                if (!session.source || session.state === CallState.Terminated) return finish()
                const frame = queue.shift()
                if (frame) {
                    // El cancelador de eco necesita la referencia en AMBOS caminos: sin esto,
                    // activar el streaming dejaba el AEC a ciegas (retardo nunca encontrado).
                    this.notifyOutboundFrame(frame, sampleRate)
                    if (this.firstFrameAt === null) {
                        this.firstFrameAt = Date.now() - started
                        this.emit('notice', {
                            title: '[TTS ] primer trozo de audio',
                            instructions: [
                                `${this.firstFrameAt}ms desde que se pidió la frase (streaming: no espera al audio completo)`,
                            ],
                        })
                    }
                    try {
                        session.source.onData({
                            samples: frame,
                            sampleRate,
                            bitsPerSample: 16,
                            channelCount: 1,
                            numberOfFrames: frame.length,
                        })
                    } catch (err) {
                        return finish(err as Error)
                    }
                } else if (producerDone) {
                    return failure ? finish(failure) : finish()
                }
                // Absolute deadline to avoid drift; if the producer underran, resync to now.
                deadline += PUBLISH_FRAME_MS
                if (deadline < Date.now()) deadline = Date.now() + PUBLISH_FRAME_MS
                session.playbackTimer = setTimeout(tick, Math.max(0, deadline - Date.now()))
            }
            tick()
            void producer
        })
    }

    private pushFramesPaced(session: CallSession, frames: Int16Array[], sampleRate: number): Promise<void> {
        if (!frames.length) return Promise.resolve()
        const started = Date.now()
        return new Promise<void>((resolve, reject) => {
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
                if (!session.source || session.state === CallState.Terminated || i >= frames.length) {
                    finish()
                    return
                }
                const frame = frames[i]
                if (this.firstFrameAt === null) {
                    this.firstFrameAt = Date.now() - started
                    this.emit('notice', {
                        title: '[TTS ] primer trozo de audio',
                        instructions: [
                            `${this.firstFrameAt}ms desde que se pidió la frase (sin streaming: esperó al audio completo)`,
                        ],
                    })
                }
                this.notifyOutboundFrame(frame, sampleRate)
                try {
                    session.source.onData({
                        samples: frame,
                        sampleRate,
                        bitsPerSample: 16,
                        channelCount: 1,
                        numberOfFrames: frame.length,
                    })
                } catch (err) {
                    reject(err)
                    finish()
                    return
                }
                i++
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

        this.cancelResponse(callId)
        // Remove first: pc.close() may synchronously re-enter the state handler.
        session.state = CallState.Terminated
        this.sessions.delete(callId)
        if (this.phoneToCallId.get(session.callerPhone) === callId) this.phoneToCallId.delete(session.callerPhone)

        // Break JS/native callback cycles as part of disposal, not at process exit.
        session.pc.onconnectionstatechange = null
        session.pc.oniceconnectionstatechange = null
        session.pc.onicecandidate = null
        session.pc.ontrack = null
        try {
            if (session.sink) {
                session.sink.ondata = null
                session.sink.stop()
            }
        } catch {
            // ignore sink stop errors
        }
        session.sink = null

        try {
            session.outboundTrack?.stop()
        } catch {
            // ignore track stop errors
        }
        session.outboundTrack = undefined
        session.source = null
        try {
            session.pc.close()
        } catch {
            // ignore PC close errors
        }
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
