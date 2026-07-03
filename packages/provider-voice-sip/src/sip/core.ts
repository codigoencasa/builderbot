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
import {
    AccessToken,
    SipClient,
    type SipDispatchRuleDirect,
    type SipDispatchRuleIndividual,
    type SIPDispatchRuleInfo,
    type SIPInboundTrunkInfo,
} from 'livekit-server-sdk'
import { EventEmitter } from 'node:events'
import OpenAI from 'openai'

import { bufferToInt16, chunkPcm, SilenceSegmenter } from '../audio'
import { transcribe } from '../stt'
import { synthesize, TTS_SAMPLE_RATE } from '../tts'
import type { ISIPProviderArgs, SIPPayload } from '../types'

const PUBLISH_FRAME_MS = 10

/**
 * Core vendor for the SIP provider. Sets up a LiveKit SIP inbound trunk and
 * dispatch rule so incoming PSTN calls land in a room as participants, then
 * runs the same audio pipeline (Whisper STT → `message` event → OpenAI TTS)
 * as the WebRTC voice provider.
 */
export class LiveKitSIPCore extends EventEmitter {
    public room: Room
    private readonly openai: OpenAI
    private readonly args: ISIPProviderArgs
    private sipClient: SipClient | null = null
    private trunk: SIPInboundTrunkInfo | null = null
    private dispatchRule: SIPDispatchRuleInfo | null = null
    private audioSource: AudioSource | null = null
    private publishedTrack: LocalAudioTrack | null = null

    /** Serializes utterance handling so transcriptions emit in spoken order. */
    private utteranceQueue: Promise<void> = Promise.resolve()

    constructor(args: ISIPProviderArgs) {
        super()
        this.args = args
        this.openai = new OpenAI({ apiKey: args.openaiApiKey })
        this.room = new Room()
    }

    /**
     * 1. Create SIP inbound trunk + dispatch rule.
     * 2. Connect the bot to the room (to publish TTS audio).
     *
     * Must be called AFTER provider bus listeners are attached (afterHttpServerInit).
     */
    public async connect(): Promise<void> {
        try {
            const host = this.args.wsUrl.replace(/^wss?:\/\//, '')
            this.sipClient = new SipClient(host, this.args.apiKey, this.args.apiSecret)

            // Create the inbound trunk (phone numbers that accept calls)
            this.trunk = await this.sipClient.createSipInboundTrunk(
                'builderbot-sip-inbound',
                this.args.inboundNumbers,
                {
                    allowedAddresses: this.args.allowedAddresses ?? [],
                    allowedNumbers: this.args.allowedCallNumbers ?? [],
                    authUsername: this.args.sipAuthUsername ?? '',
                    authPassword: this.args.sipAuthPassword ?? '',
                    headersToAttributes: this.args.headersToAttributes ?? {},
                    krispEnabled: this.args.krispEnabled ?? false,
                }
            )

            // Create the dispatch rule (routes inbound INVITE to a room)
            const roomForRule = this.args.roomName ?? 'sip-support'
            this.dispatchRule = await this.sipClient.createSipDispatchRule(this.buildDispatchRule(roomForRule), {
                trunkIds: [this.trunk.sipTrunkId],
            })

            // Connect the bot itself to the room so it can publish TTS audio
            this.room.on(RoomEvent.TrackSubscribed, this.onTrackSubscribed).on(RoomEvent.Disconnected, () =>
                this.emit('notice', {
                    title: '🔌 LiveKit SIP disconnected',
                    instructions: ['The bot left the room.'],
                })
            )

            const token = await this.buildToken(this.args.identity ?? 'builderbot-sip', roomForRule)
            await this.room.connect(this.args.wsUrl, token, { autoSubscribe: true, dynacast: true })

            this.emit('host', {
                phone: this.args.inboundNumbers[0],
                room: roomForRule,
                trunkId: this.trunk.sipTrunkId,
                dispatchRuleId: this.dispatchRule.sipDispatchRuleId,
            })
            this.emit('ready', true)
        } catch (error) {
            this.emit('auth_failure', error)
            throw error
        }
    }

    /**
     * Delete the dispatch rule and trunk from LiveKit, then disconnect the room.
     * Cleans up server-side persistent resources so they don't accumulate on restart.
     */
    public async close(): Promise<void> {
        try {
            if (this.dispatchRule && this.sipClient) {
                await this.sipClient.deleteSipDispatchRule(this.dispatchRule.sipDispatchRuleId)
                this.dispatchRule = null
            }
            if (this.trunk && this.sipClient) {
                await this.sipClient.deleteSipTrunk(this.trunk.sipTrunkId)
                this.trunk = null
            }
        } catch (error) {
            this.emit('notice', {
                title: '🟠 SIP cleanup error',
                instructions: [String(error)],
            })
        }
        await this.room.disconnect()
        this.audioSource = null
        this.publishedTrack = null
    }

    /**
     * Synthesize `text` to speech and publish it into the room so the SIP
     * endpoint (PSTN caller) receives it via RTP.
     */
    public async publishAudio(text: string): Promise<void> {
        const pcm = await synthesize(this.openai, text, {
            model: this.args.ttsModel,
            voice: this.args.ttsVoice,
        })

        const source = await this.ensureAudioSource()
        const samplesPerFrame = Math.round((PUBLISH_FRAME_MS / 1000) * TTS_SAMPLE_RATE)
        const frames = chunkPcm(bufferToInt16(pcm), samplesPerFrame, false)

        for (const frame of frames) {
            const audioFrame = new AudioFrame(frame, TTS_SAMPLE_RATE, 1, frame.length)
            await source.captureFrame(audioFrame)
        }
    }

    /**
     * Mint a LiveKit access token (reused by the /token HTTP endpoint).
     */
    public async buildToken(identity: string, room: string): Promise<string> {
        const at = new AccessToken(this.args.apiKey, this.args.apiSecret, { identity })
        at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true })
        return at.toJwt()
    }

    private buildDispatchRule(roomForRule: string): SipDispatchRuleDirect | SipDispatchRuleIndividual {
        const type = this.args.dispatchRuleType ?? 'direct'

        if (type === 'individual') {
            const rule: SipDispatchRuleIndividual = {
                type: 'individual',
                roomPrefix: this.args.dispatchRuleRoomPrefix ?? 'call-',
            }
            if (this.args.dispatchRulePin) rule.pin = this.args.dispatchRulePin
            return rule
        }

        const rule: SipDispatchRuleDirect = {
            type: 'direct',
            roomName: roomForRule,
        }
        if (this.args.dispatchRulePin) rule.pin = this.args.dispatchRulePin
        return rule
    }

    private async ensureAudioSource(): Promise<AudioSource> {
        if (this.audioSource) return this.audioSource

        const source = new AudioSource(TTS_SAMPLE_RATE, 1)
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

    // ── Audio pipeline: identical to provider-voice/core.ts ──────────────────

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
                title: '🟠 SIP audio stream error',
                instructions: [String(error)],
            })
        } finally {
            if (segmenter) {
                this.enqueueUtterance(segmenter.flush(), sampleRate, participant)
            }
        }
    }

    private enqueueUtterance(pcm: Buffer | null, sampleRate: number, participant: RemoteParticipant): void {
        if (!pcm) return
        this.utteranceQueue = this.utteranceQueue.then(() => this.handleUtterance(pcm, sampleRate, participant))
    }

    private async handleUtterance(pcm: Buffer, sampleRate: number, participant: RemoteParticipant): Promise<void> {
        try {
            const body = await transcribe(this.openai, pcm, {
                model: this.args.sttModel,
                language: this.args.language,
                sampleRate,
            })
            if (!body) return

            const payload: SIPPayload = {
                body,
                from: participant.identity,
                name: participant.name ?? participant.identity,
                audio: pcm,
                sampleRate,
            }
            this.emit('message', payload)
        } catch (error) {
            this.emit('notice', {
                title: '🟠 SIP transcription error',
                instructions: [String(error)],
            })
        }
    }

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
