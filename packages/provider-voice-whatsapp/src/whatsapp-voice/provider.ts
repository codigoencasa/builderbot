/**
 * WhatsApp Voice Provider for BuilderBot.
 *
 * Accepts inbound WhatsApp Business voice calls via the Meta Graph API,
 * negotiates WebRTC/SDP, runs an STT/TTS audio pipeline, and surfaces
 * bot interactions through the standard BuilderBot `message` event interface.
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/calling/
 */

import { ProviderClass } from '@builderbot/bot'
import type { BotContext, SendOptions } from '@builderbot/bot/dist/types'
import { OpenAISTTAdapter } from '@builderbot/provider-voice'
import { OpenAITTSAdapter } from '@builderbot/provider-voice'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { pcmToWav } from '../audio'
import type { WhatsAppVoiceInterface } from '../interface/whatsapp-voice'
import type {
    IWhatsAppVoiceProviderArgs,
    ISttAdapter,
    ITtsAdapter,
    WhatsAppCallWebhookPayload,
    WhatsAppVoicePayload,
} from '../types'
import { CallEvent } from '../types'
import { WhatsAppCallCoreVendor } from './core'

/** Meta Graph API docs URL — included in validation error messages. */
const META_DOCS_URL = 'https://developers.facebook.com/docs/whatsapp/cloud-api/calling/'

/**
 * WhatsApp Business voice call provider for BuilderBot.
 *
 * Use `createProvider(WhatsAppVoiceProvider, { ... })` with valid Meta credentials
 * to accept inbound WhatsApp voice calls. The bot receives transcribed caller
 * utterances as standard `message` events and can reply using `sendMessage`.
 *
 * @example
 * import { createProvider } from '@builderbot/bot'
 * import { WhatsAppVoiceProvider } from '@builderbot/provider-voice-whatsapp'
 *
 * const provider = createProvider(WhatsAppVoiceProvider, {
 *   jwtToken: process.env.META_JWT_TOKEN,
 *   numberId: process.env.META_NUMBER_ID,
 *   verifyToken: process.env.META_VERIFY_TOKEN,
 *   version: 'v20.0',
 *   openaiApiKey: process.env.OPENAI_API_KEY,
 * })
 */
class WhatsAppVoiceProvider extends ProviderClass<WhatsAppCallCoreVendor> implements WhatsAppVoiceInterface {
    /** Resolved configuration merged with defaults. */
    public globalVendorArgs: IWhatsAppVoiceProviderArgs

    constructor(args: IWhatsAppVoiceProviderArgs) {
        super()

        // Validate required fields before any network calls or server binding.
        WhatsAppVoiceProvider.validateConfig(args)

        this.globalVendorArgs = {
            name: 'whatsapp-voice-bot',
            port: 3000,
            writeMyself: 'none',
            ...args,
        } as IWhatsAppVoiceProviderArgs
    }

    // ── Configuration validation ───────────────────────────────────────────────

    /**
     * Validate all required configuration fields.
     *
     * Throws a descriptive error (with the Meta docs URL) if any required field
     * is absent or empty. Validation runs synchronously in the constructor so the
     * webhook server never starts with an incomplete config.
     *
     * @param args The provider configuration to validate.
     * @throws {Error} When a required field is missing.
     */
    private static validateConfig(args: IWhatsAppVoiceProviderArgs): void {
        const required: Array<keyof IWhatsAppVoiceProviderArgs> = ['jwtToken', 'numberId', 'verifyToken', 'version']

        for (const field of required) {
            const value = args[field as keyof typeof args]
            if (!value || (typeof value === 'string' && value.trim() === '')) {
                throw new Error(
                    `[WhatsAppVoiceProvider] Required configuration field "${field}" is missing or empty. ` +
                        `This field is required to authenticate with the Meta Graph API and verify webhooks. ` +
                        `See the docs: ${META_DOCS_URL}`
                )
            }
        }

        // openaiApiKey required unless both adapters are provided.
        const hasOpenAI = 'openaiApiKey' in args && Boolean((args as { openaiApiKey?: string }).openaiApiKey)
        const hasStt = Boolean(args.sttAdapter)
        const hasTts = Boolean(args.ttsAdapter)

        if (!hasOpenAI && !(hasStt && hasTts)) {
            throw new Error(
                `[WhatsAppVoiceProvider] "openaiApiKey" is required when custom STT and TTS adapters are not ` +
                    `both provided. Either set openaiApiKey, or provide both sttAdapter and ttsAdapter. ` +
                    `See the docs: ${META_DOCS_URL}`
            )
        }
    }

    // ── Provider lifecycle ────────────────────────────────────────────────────

    /**
     * Build the core vendor instance with resolved STT/TTS adapters.
     *
     * The core is NOT connected here — adapters are injected and the core is
     * stored as `this.vendor`. Actual call processing begins once the HTTP server
     * is running and webhook events start arriving.
     *
     * @returns The initialized `WhatsAppCallCoreVendor`.
     */
    protected async initVendor(): Promise<WhatsAppCallCoreVendor> {
        const { sttAdapter, ttsAdapter } = this.resolveAdapters()

        const vendor = new WhatsAppCallCoreVendor({
            sttAdapter,
            ttsAdapter,
            config: this.globalVendorArgs,
        })

        this.vendor = vendor
        return vendor
    }

    /**
     * Wire core EventEmitter events to the provider bus.
     *
     * @returns Array of event-handler pairs consumed by ProviderClass.
     */
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
            func: (payload: WhatsAppVoicePayload) => this.emit('message', payload as BotContext),
        },
    ]

    /**
     * Register webhook routes on the polka HTTP server.
     *
     * - `GET /webhook` — Meta hub.verify_token handshake.
     * - `POST /webhook` — Inbound call events (connect / terminate).
     */
    protected beforeHttpServerInit(): void {
        this.server = this.server
            .use((req, _, next) => {
                req['globalVendorArgs'] = this.globalVendorArgs
                return next()
            })
            .get('/webhook', this.handleVerification)
            .post('/webhook', this.handleWebhook)
    }

    /**
     * Emit `ready` once the HTTP server is bound and webhook routes are live.
     */
    protected afterHttpServerInit(): void {
        this.vendor.emit('ready', true)
    }

    // ── Public provider API ───────────────────────────────────────────────────

    /**
     * Synthesize `message` to speech and send it to the caller over their active
     * WebRTC peer connection.
     *
     * @param userId  The caller's phone number (the call_id used as the session key).
     * @param message Text to synthesize and transmit.
     * @param options Optional send options — media and buttons are not supported.
     * @returns Resolves when audio has been pushed to the peer connection.
     */
    public async sendMessage<K = unknown>(userId: string, message: string, options?: SendOptions): Promise<K> {
        if (options?.media || (options?.buttons && (options.buttons as unknown[]).length)) {
            this.emit('notice', {
                title: 'WhatsApp Voice: unsupported send options',
                instructions: ['provider-voice-whatsapp ignores media/buttons; only text-to-speech is sent.'],
            })
        }
        await this.vendor.publishAudio(userId, message)
        return undefined as K
    }

    /**
     * Save the caller's audio utterance to the local filesystem as a WAV file.
     *
     * Reads `ctx.audio` (raw PCM) and wraps it in a standard RIFF/WAVE container.
     *
     * @param ctx     Message context — must contain `ctx.audio` (PCM buffer).
     * @param options Optional `{ path }` for the destination directory. Defaults to `os.tmpdir()`.
     * @returns Absolute path to the saved WAV file, or 'ERROR' on failure.
     */
    public async saveFile(
        ctx: Partial<WhatsAppVoicePayload & BotContext>,
        options?: { path: string }
    ): Promise<string> {
        if (!ctx.audio) {
            this.emit('notice', {
                title: 'WhatsApp Voice: saveFile — no audio buffer',
                instructions: ['ctx.audio is not present. saveFile requires a ctx with an audio buffer.'],
            })
            return 'ERROR'
        }
        try {
            const wav = pcmToWav(ctx.audio, ctx.sampleRate ?? 16000)
            const fileName = `voice-call-${ctx.from ?? 'unknown'}-${Date.now()}.wav`
            const filePath = join(options?.path ?? tmpdir(), fileName)
            await writeFile(filePath, wav)
            return resolve(filePath)
        } catch (err) {
            this.emit('notice', {
                title: 'WhatsApp Voice: saveFile error',
                instructions: [(err as Error).message],
            })
            return 'ERROR'
        }
    }

    // ── Private HTTP handlers ─────────────────────────────────────────────────

    /**
     * Handle the Meta webhook verification handshake.
     *
     * Meta sends `GET /webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`.
     * When `hub.verify_token` matches our configured token we respond with the challenge.
     */
    private handleVerification: (req: unknown, res: unknown) => void = (req, res) => {
        const request = req as {
            query: Record<string, string>
        }
        const response = res as {
            end(body?: string): void
            writeHead(status: number): void
        }

        const mode = request.query['hub.mode']
        const token = request.query['hub.verify_token']
        const challenge = request.query['hub.challenge']

        if (mode === 'subscribe' && token === this.globalVendorArgs.verifyToken) {
            response.writeHead(200)
            response.end(challenge)
        } else {
            response.writeHead(403)
            response.end('Forbidden')
        }
    }

    /**
     * Handle inbound Meta webhook POST events.
     *
     * Parses the JSON body, filters `field: "calls"` entries, and dispatches
     * each call event to the core vendor. Non-call fields are silently ignored.
     * Always responds HTTP 200 to prevent Meta from retrying valid deliveries.
     */
    private handleWebhook: (req: unknown, res: unknown) => void = (req, res) => {
        const request = req as {
            body: WhatsAppCallWebhookPayload | Record<string, unknown>
        }
        const response = res as {
            end(body?: string): void
            writeHead(status: number): void
        }

        // Always respond 200 first to prevent Meta retries on slow processing.
        response.writeHead(200)
        response.end('OK')

        try {
            const payload = request.body as WhatsAppCallWebhookPayload
            if (!payload?.entry?.length) return

            for (const entry of payload.entry) {
                if (!entry.changes?.length) continue

                for (const change of entry.changes) {
                    if (change.field !== 'calls') continue
                    const callsValue = change.value
                    if (!callsValue?.calls?.length) continue

                    for (const callEvent of callsValue.calls) {
                        if (callEvent.event === CallEvent.Connect) {
                            void this.vendor.onConnect(callEvent)
                        } else if (callEvent.event === CallEvent.Terminate) {
                            this.vendor.onTerminate(callEvent.id)
                        }
                    }
                }
            }
        } catch (err) {
            this.emit('notice', {
                title: 'WhatsApp Voice: webhook parse error',
                instructions: [(err as Error).message],
            })
        }
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    /**
     * Resolve STT and TTS adapters from the provider configuration.
     *
     * Uses provided custom adapters when available; otherwise constructs the
     * default OpenAI Whisper (STT) and OpenAI TTS adapters from `openaiApiKey`.
     *
     * @returns Resolved `{ sttAdapter, ttsAdapter }`.
     */
    private resolveAdapters(): { sttAdapter: ISttAdapter; ttsAdapter: ITtsAdapter } {
        const config = this.globalVendorArgs

        const openaiApiKey = 'openaiApiKey' in config ? ((config as { openaiApiKey?: string }).openaiApiKey ?? '') : ''

        const sttAdapter: ISttAdapter = config.sttAdapter ?? new OpenAISTTAdapter({ apiKey: openaiApiKey })

        const ttsAdapter: ITtsAdapter = config.ttsAdapter ?? new OpenAITTSAdapter({ apiKey: openaiApiKey })

        return { sttAdapter, ttsAdapter }
    }
}

export { WhatsAppVoiceProvider }
