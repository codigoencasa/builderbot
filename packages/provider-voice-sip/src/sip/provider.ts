import { ProviderClass } from '@builderbot/bot'
import type { BotContext, SendOptions } from '@builderbot/bot/dist/types'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type polka from 'polka'

import { pcmToWav } from '../audio'
import type { SIPInterface } from '../interface/sip'
import type { ISIPProviderArgs, SIPPayload } from '../types'
import { generateAudioFileName } from '../utils'
import { LiveKitSIPCore } from './core'

/**
 * PSTN/SIP voice provider for BuilderBot.
 *
 * Creates a LiveKit SIP inbound trunk so callers dialing one of the configured
 * `inboundNumbers` land in a LiveKit room as participants. Their audio is
 * transcribed with Whisper and emitted as a `message` (keyword flows match it
 * like any other provider). Text replies are synthesized with OpenAI TTS and
 * sent back to the caller as audio via RTP.
 */
class SIPProvider extends ProviderClass<LiveKitSIPCore> implements SIPInterface {
    globalVendorArgs: ISIPProviderArgs

    constructor(args: ISIPProviderArgs) {
        super()
        this.globalVendorArgs = {
            name: 'sip-bot',
            port: 3000,
            writeMyself: 'none',
            identity: 'builderbot-sip',
            dispatchRuleType: 'direct',
            roomName: 'sip-support',
            sttModel: 'whisper-1',
            ttsModel: 'gpt-4o-mini-tts',
            ttsVoice: 'alloy',
            silenceMs: 800,
            silenceThreshold: 0.015,
            apiKey: undefined,
            apiSecret: undefined,
            wsUrl: undefined,
            inboundNumbers: [],
            openaiApiKey: undefined,
            ...args,
        }
    }

    protected async initVendor(): Promise<LiveKitSIPCore> {
        // Only build the vendor here. The framework's listenOnEvents runs AFTER
        // initVendor resolves, so we cannot connect yet — connect-time events
        // ('host'/'ready'/'auth_failure') would be lost. connect() is called in
        // afterHttpServerInit once listeners are wired.
        const vendor = new LiveKitSIPCore(this.globalVendorArgs)
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
            func: (payload: SIPPayload) => this.emit('message', payload as BotContext),
        },
    ]

    /**
     * Synthesize `message` to speech and broadcast it in the room so the PSTN
     * caller hears the reply. `userId` is ignored (room-level broadcast).
     * `options.media` and `options.buttons` are not supported and emit a notice.
     */
    public async sendMessage<K = unknown>(_userId: string, message: string, options?: SendOptions): Promise<K> {
        if (options?.media || options?.buttons?.length) {
            this.emit('notice', {
                title: '🟠 Unsupported send options',
                instructions: ['provider-voice-sip ignores media/buttons; only text-to-speech is sent.'],
            })
        }
        await this.vendor.publishAudio(message)
        return undefined as K
    }

    public async saveFile(ctx: Partial<SIPPayload & BotContext>, options?: { path: string }): Promise<string> {
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
        // Listeners are wired now — connect creates trunk + dispatch rule + joins room.
        void this.vendor.connect().catch(() => undefined)
    }

    private indexHome: polka.Middleware = (_req, res) => {
        res.end('voice-sip provider running')
    }

    /**
     * Mint a LiveKit access token for a web client to join the same room.
     * GET /token?identity=<id>&room=<room>
     * NOTE: unauthenticated — protect this endpoint in production.
     */
    private handlerToken: polka.Middleware = async (req, res) => {
        const query = req.query as { identity?: string; room?: string }
        const identity = query?.identity ?? `guest-${Date.now()}`
        const room = query?.room ?? this.globalVendorArgs.roomName ?? 'sip-support'
        const token = await this.vendor.buildToken(identity, room)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ token, wsUrl: this.globalVendorArgs.wsUrl, room, identity }))
    }
}

export { SIPProvider }
