import {
    AudioFrame,
    AudioSource,
    AudioStream,
    LocalAudioTrack,
    Room,
    RoomEvent,
    TrackKind,
    TrackPublishOptions,
    TrackSource,
    type RemoteParticipant,
    type RemoteTrack,
    type RemoteTrackPublication,
} from '@livekit/rtc-node'
import { AccessToken } from 'livekit-server-sdk'
import { EventEmitter } from 'node:events'

import type { ISttAdapter, ITtsAdapter } from '../adapters/index'
import { OpenAISTTAdapter } from '../adapters/stt/openai'
import { OpenAITTSAdapter } from '../adapters/tts/openai'
import { bufferToInt16, chunkPcm, SilenceSegmenter } from '../audio'
import type { IVoiceProviderArgs, VoicePayload } from '../types'

/** 10 ms frames for publishing into LiveKit. */
const PUBLISH_FRAME_MS = 10

/**
 * Manages the LiveKit room connection and the bidirectional audio pipeline:
 * incoming audio tracks -> STT adapter -> `message` events, and text -> TTS
 * adapter -> published audio track. Emits the standard provider events the
 * VoiceProvider re-broadcasts to the bot framework.
 */
export class LiveKitCoreVendor extends EventEmitter {
    public room: Room
    private readonly sttAdapter: ISttAdapter
    private readonly ttsAdapter: ITtsAdapter
    private readonly args: IVoiceProviderArgs

    private audioSource: AudioSource | null = null
    private publishedTrack: LocalAudioTrack | null = null

    /**
     * Serializes utterance handling so transcriptions are emitted in the order
     * they were spoken, regardless of variable STT latency.
     */
    private utteranceQueue: Promise<void> = Promise.resolve()

    constructor(args: IVoiceProviderArgs) {
        super()
        this.args = args
        this.room = new Room()

        // Resolve STT adapter: use provided adapter or fall back to OpenAI default.
        this.sttAdapter =
            args.sttAdapter ??
            new OpenAISTTAdapter({
                apiKey: args.openaiApiKey as string,
                model: args.sttModel,
            })

        // Resolve TTS adapter: use provided adapter or fall back to OpenAI default.
        this.ttsAdapter =
            args.ttsAdapter ??
            new OpenAITTSAdapter({
                apiKey: args.openaiApiKey as string,
                model: args.ttsModel,
                voice: args.ttsVoice,
            })
    }

    /**
     * Mint an access token, connect to the configured room and wire audio
     * subscription. Emits 'host' and 'ready' on success, 'auth_failure' on error.
     *
     * Must be called AFTER the provider's event listeners are attached (i.e.
     * from afterHttpServerInit, not from initVendor) so the connect-time
     * 'host'/'ready'/'auth_failure' events are not lost.
     */
    public async connect(): Promise<void> {
        try {
            const token = await this.buildToken(this.args.identity ?? 'builderbot', this.args.roomName)

            this.room.on(RoomEvent.TrackSubscribed, this.onTrackSubscribed).on(RoomEvent.Disconnected, () =>
                this.emit('notice', {
                    title: '🔌 LiveKit disconnected',
                    instructions: ['The bot left the room.'],
                })
            )

            await this.room.connect(this.args.wsUrl, token, { autoSubscribe: true, dynacast: true })

            // Pre-publish the audio source so it is ready before the first TTS reply.
            await this.ensureAudioSource()

            this.emit('host', { phone: this.args.identity ?? 'builderbot', room: this.args.roomName })
            this.emit('ready', true)
        } catch (error) {
            this.emit('auth_failure', error)
            throw error
        }
    }

    /**
     * Generate a LiveKit access token for a given identity/room. Reused by the
     * provider's HTTP `/token` endpoint so frontend clients can join.
     */
    public async buildToken(identity: string, room: string): Promise<string> {
        const at = new AccessToken(this.args.apiKey, this.args.apiSecret, { identity })
        at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true })
        return at.toJwt()
    }

    /**
     * Synthesize text to speech via the configured TTS adapter and publish it
     * into the room as audio.
     */
    public async publishAudio(text: string): Promise<void> {
        const pcm = await this.ttsAdapter.synthesize(text)
        const ttsRate = this.ttsAdapter.sampleRate

        const source = await this.ensureAudioSource()
        const samplesPerFrame = Math.round((PUBLISH_FRAME_MS / 1000) * ttsRate)
        // pad=false: keep the final frame's real length so playback doesn't end
        // on a zero tail (which is audible as a click after every reply).
        const frames = chunkPcm(bufferToInt16(pcm), samplesPerFrame, false)

        for (const frame of frames) {
            const audioFrame = new AudioFrame(frame, ttsRate, 1, frame.length)
            try {
                await source.captureFrame(audioFrame)
            } catch {
                // Frame dropped if source is momentarily not ready — non-fatal
            }
        }
    }

    /**
     * Disconnect from the room and release the publishing source.
     */
    public async close(): Promise<void> {
        await this.room.disconnect()
        this.audioSource = null
        this.publishedTrack = null
    }

    private async ensureAudioSource(): Promise<AudioSource> {
        if (this.audioSource) return this.audioSource

        const source = new AudioSource(this.ttsAdapter.sampleRate, 1)
        const track = LocalAudioTrack.createAudioTrack('voice', source)
        const options = new TrackPublishOptions()
        options.source = TrackSource.SOURCE_MICROPHONE
        await this.room.localParticipant?.publishTrack(track, options)

        this.audioSource = source
        this.publishedTrack = track
        return source
    }

    private onTrackSubscribed = (
        track: RemoteTrack,
        _publication: RemoteTrackPublication,
        participant: RemoteParticipant
    ): void => {
        if (track.kind !== TrackKind.KIND_AUDIO) return
        void this.consumeAudioTrack(track, participant)
    }

    private async consumeAudioTrack(track: RemoteTrack, participant: RemoteParticipant): Promise<void> {
        const stream = new AudioStream(track)
        let segmenter: SilenceSegmenter | null = null
        let sampleRate = 0

        const buildSegmenter = (rate: number): SilenceSegmenter =>
            new SilenceSegmenter({
                sampleRate: rate,
                silenceMs: this.args.silenceMs ?? 800,
                silenceThreshold: this.args.silenceThreshold ?? 0.015,
            })

        try {
            for await (const frame of stream) {
                // Sample rate can change mid-stream (renegotiation). Flush the
                // current utterance and rebuild the segmenter for the new rate
                // so the WAV header always matches the audio it describes.
                if (segmenter && frame.sampleRate !== sampleRate) {
                    this.enqueueUtterance(segmenter.flush(), sampleRate, participant)
                    segmenter = null
                }

                if (!segmenter) {
                    sampleRate = frame.sampleRate
                    segmenter = buildSegmenter(sampleRate)
                }

                const mono = this.toMono(frame.data, frame.channels)
                this.enqueueUtterance(segmenter.push(mono), sampleRate, participant)
            }
        } catch (error) {
            this.emit('notice', {
                title: '🟠 Audio stream error',
                instructions: [String(error)],
            })
        } finally {
            // The stream ended (participant unpublished/left). Don't drop a
            // complete-but-unclosed final utterance (no trailing silence).
            if (segmenter) {
                this.enqueueUtterance(segmenter.flush(), sampleRate, participant)
            }
        }
    }

    /**
     * Queue an utterance for transcription so emits stay in spoken order even
     * though Whisper latency varies per call. No-ops when pcm is null.
     */
    private enqueueUtterance(pcm: Buffer | null, sampleRate: number, participant: RemoteParticipant): void {
        if (!pcm) return
        this.utteranceQueue = this.utteranceQueue.then(() => this.handleUtterance(pcm, sampleRate, participant))
    }

    private async handleUtterance(pcm: Buffer, sampleRate: number, participant: RemoteParticipant): Promise<void> {
        try {
            const body = await this.sttAdapter.transcribe(pcm, sampleRate, this.args.language)
            if (!body) return

            const payload: VoicePayload = {
                body,
                from: participant.identity,
                name: participant.name ?? participant.identity,
                audio: pcm,
                sampleRate,
            }
            this.emit('message', payload)
        } catch (error) {
            this.emit('notice', {
                title: '🟠 Transcription error',
                instructions: [String(error)],
            })
        }
    }

    /**
     * Downmix interleaved PCM to mono. Resamples nothing — keeps the source rate.
     */
    private toMono(data: Int16Array, channels: number): Int16Array {
        if (channels <= 1) return data
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
