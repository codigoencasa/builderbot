import { ProviderClass } from '@builderbot/bot'
import type { BotContext, SendOptions } from '@builderbot/bot/dist/types'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type polka from 'polka'

import { pcmToWav } from '../audio'
import type { VoiceInterface } from '../interface/voice'
import { SttModel, TtsModel, TtsVoice } from '../types'
import type { IVoiceProviderArgs, VoicePayload } from '../types'
import { generateAudioFileName } from '../utils'
import { LiveKitCoreVendor } from './core'

/**
 * Realtime voice provider for BuilderBot built on LiveKit (WebRTC) + OpenAI.
 *
 * Incoming room audio is transcribed with Whisper and emitted as a `message`
 * (so existing keyword flows match it); text replies are synthesized with
 * OpenAI TTS and published back into the room as an audio track.
 */
class VoiceProvider extends ProviderClass<LiveKitCoreVendor> implements VoiceInterface {
    globalVendorArgs: IVoiceProviderArgs

    constructor(args: IVoiceProviderArgs) {
        super()
        this.globalVendorArgs = {
            name: 'voice-bot',
            port: 3000,
            writeMyself: 'none',
            identity: 'builderbot',
            sttModel: SttModel.Gpt4oMiniTranscribe,
            ttsModel: TtsModel.Gpt4oMiniTts,
            ttsVoice: TtsVoice.Alloy,
            silenceMs: 800,
            silenceThreshold: 0.015,
            apiKey: undefined,
            apiSecret: undefined,
            wsUrl: undefined,
            roomName: undefined,
            openaiApiKey: undefined,
            ...args,
        }
    }

    protected async initVendor(): Promise<LiveKitCoreVendor> {
        // Only build the vendor here. The framework attaches our busEvents
        // listeners (via listenOnEvents) AFTER initVendor resolves, so we must
        // NOT connect yet — connect-time 'host'/'ready'/'auth_failure' would be
        // emitted before any listener exists and silently lost. We connect in
        // afterHttpServerInit instead, once listeners are wired.
        const vendor = new LiveKitCoreVendor(this.globalVendorArgs)
        this.vendor = vendor
        return vendor
    }

    protected busEvents = () => [
        {
            event: 'auth_failure',
            func: (payload: unknown) => this.emit('auth_failure', payload),
        },
        {
            event: 'ready',
            func: () => this.emit('ready', true),
        },
        {
            event: 'host',
            func: (payload: unknown) => this.emit('host', payload),
        },
        {
            event: 'notice',
            func: (payload: { title: string; instructions: string[] }) => this.emit('notice', payload),
        },
        {
            event: 'message',
            func: (payload: VoicePayload) => this.emit('message', payload as BotContext),
        },
    ]

    /**
     * Synthesize `message` to speech and publish it into the room. Note: audio
     * is broadcast to every participant in the room — `userId` does not target
     * an individual, and `options.media`/`options.buttons` are not supported.
     */
    public async sendMessage<K = unknown>(_userId: string, message: string, options?: SendOptions): Promise<K> {
        if (options?.media || options?.buttons?.length) {
            this.emit('notice', {
                title: '🟠 Unsupported send options',
                instructions: ['provider-voice ignores media/buttons; only text-to-speech is sent.'],
            })
            return undefined as K
        }
        await this.vendor.publishAudio(message)
        return undefined as K
    }

    public async saveFile(ctx: Partial<VoicePayload & BotContext>, options?: { path: string }): Promise<string> {
        if (!ctx.audio) {
            throw new Error('No audio buffer present on the context to save.')
        }
        const wav = pcmToWav(ctx.audio, ctx.sampleRate ?? 16000)
        const fileName = generateAudioFileName(ctx.from ?? 'unknown')
        const filePath = join(options?.path ?? tmpdir(), fileName)
        await writeFile(filePath, wav)
        return resolve(filePath)
    }

    protected beforeHttpServerInit(): void {
        this.server = this.server
            .use((req, _, next) => {
                req['globalVendorArgs'] = this.globalVendorArgs
                return next()
            })
            .get('/', this.indexHome)
            .get('/token', this.handlerToken)
    }

    protected afterHttpServerInit(): void {
        // Listeners are wired by now; connect-time events reach the bot. We
        // don't await (this hook is sync) and catch so a failed connection
        // surfaces as 'auth_failure' instead of an unhandled rejection.
        void this.vendor.connect().catch(() => undefined)
    }

    private indexHome: polka.Middleware = (_req, res) => {
        res.end('voice provider running')
    }

    /**
     * Mint a LiveKit access token so a frontend client can join the room.
     * GET /token?identity=<id>&room=<room>
     */
    private handlerToken: polka.Middleware = async (req, res) => {
        const query = req.query as { identity?: string; room?: string }
        const identity = query?.identity ?? `guest-${Date.now()}`
        const room = query?.room ?? this.globalVendorArgs.roomName
        const token = await this.vendor.buildToken(identity, room)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ token, wsUrl: this.globalVendorArgs.wsUrl, room, identity }))
    }
}

export { VoiceProvider }
