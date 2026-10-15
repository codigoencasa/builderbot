/**
 * LAYER: Infrastructure
 * Contains: InworldTTSModel, InworldRegion, InworldTTSAdapterOptions, InworldTTSAdapter
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [InworldTTSModel, InworldRegion, InworldTTSAdapter]
 * GOAL: Own the "inworld" TTS concern of the provider-voice package.
 */
import type { ITtsAdapter, TtsSynthesisOptions } from '../index'

/** TTS models. Flash is the lowest-latency (and cheapest) option. */
export enum InworldTTSModel {
    /** Newest default. Supports delivery mode and language. */
    Tts2 = 'inworld-tts-2',
    /** Same quality tier, ~5x faster time to first audio. Recommended for calls. */
    Tts2Flash = 'inworld-tts-2-flash',
}

/** Regional deployments. Pick the one closest to your server to cut the network hop. */
export enum InworldRegion {
    Us = 'us',
    Eu = 'eu',
    In = 'in',
}

export type InworldTextNormalization = 'ON' | 'OFF' | 'APPLY_TEXT_NORMALIZATION_UNSPECIFIED'
export type InworldDeliveryMode = 'STABLE' | 'BALANCED' | 'CREATIVE'

export interface InworldTTSAdapterOptions {
    /** Base64 credential from the Inworld portal. Do not re-encode it. */
    apiKey: string
    /** Voice ID, e.g. 'Ashley'. See the List voices endpoint. */
    voiceId: string
    /** Model to use. Default InworldTTSModel.Tts2. */
    model?: InworldTTSModel | string
    /** Output sample rate in Hz, [8000, 48000]. Default 48000 (WebRTC native). */
    sampleRate?: number
    /** Speaking rate, [0.5, 1.5]. Default 1.0 */
    speakingRate?: number
    /** BCP-47 tag, e.g. 'es-MX'. Forces the language of the voice. */
    language?: string
    /** Regional deployment. Default InworldRegion.Us. */
    region?: InworldRegion | string
    /**
     * Server-side normalisation of numbers, dates and amounts.
     * `ON` is recommended; `OFF` is slightly faster when the LLM already writes spoken form.
     * Default `ON`.
     */
    normalization?: InworldTextNormalization
    /** Stability/expressiveness trade-off on `inworld-tts-2`. Default `BALANCED`. */
    deliveryMode?: InworldDeliveryMode
    /**
     * Send previous turns as `synthesisContext.previousRequests` so prosody continues the
     * conversation. Context text is not billed.
     *
     * Only safe when serving one call at a time unless you pass `callId`: the adapter keeps
     * a single recent-text buffer, so two concurrent calls would share it. Default `false`.
     */
    conversationContext?: boolean
    /**
     * Milliseconds allowed for the WebSocket to connect, and between audio chunks, before
     * failing. A socket that goes quiet must not leave a turn hanging. Default 5000.
     */
    streamTimeoutMs?: number
    /**
     * Explicit WebSocket base URL (`wss://…`). Defaults to the region endpoint.
     * Useful behind a proxy or in tests.
     */
    wsBaseUrl?: string
}

/** Fields of the WebSocket `create` message (snake_case, as the API expects). */
interface WsCreatePayload {
    voice_id: string
    model_id: string
    audio_config: { audio_encoding: 'PCM'; sample_rate_hertz: number; bit_rate: number }
    autoMode?: boolean
}

interface WsServerMessage {
    error?: unknown
    done?: boolean
    result?: { audioChunk?: { audioContent?: string }; contextClosed?: unknown }
}

const INWORLD_API = 'https://api.inworld.ai'

const REGIONS: Record<string, string> = {
    us: 'https://api.inworld.ai',
    eu: 'https://api.eu.inworld.ai',
    in: 'https://api.in.inworld.ai',
}

/** The non-streaming endpoint accepts up to 2,000 UTF-16 code units per request. */
const TTS_MAX_CHARS = 1800

/** How many previous turns are sent as prosody context (not billed). */
const CONTEXT_TURNS = 3

/**
 * Split text into sentences, one per WebSocket message with `flush_context`.
 * Same criteria as Inworld's own low-latency example.
 */
export const splitSentences = (text: string): string[] => {
    const matches = text.match(/[^.!?…]*[.!?…]+\s*/g) ?? []
    const sentences = matches.map((sentence) => sentence.trim()).filter(Boolean)
    const rest = text.slice(matches.join('').length).trim()
    if (rest) sentences.push(rest)
    return sentences.length ? sentences : [text]
}

/** Split text into chunks of at most `max` characters without cutting words. */
const chunkText = (text: string, max: number): string[] => {
    if (text.length <= max) return [text]

    const sentences = text.match(/[^.!?…]+[.!?…]*\s*/g) ?? [text]
    const chunks: string[] = []
    let current = ''

    for (const sentence of sentences) {
        if (sentence.length > max) {
            if (current) {
                chunks.push(current.trim())
                current = ''
            }
            const words = sentence.split(/\s+/)
            let piece = ''
            for (const word of words) {
                if ((piece + ' ' + word).trim().length > max) {
                    chunks.push(piece.trim())
                    piece = word
                } else {
                    piece = piece ? `${piece} ${word}` : word
                }
            }
            if (piece) current = piece
            continue
        }

        if ((current + sentence).length > max) {
            chunks.push(current.trim())
            current = sentence
        } else {
            current += sentence
        }
    }

    if (current.trim()) chunks.push(current.trim())
    return chunks
}

/**
 * TTS adapter for Inworld.
 *
 * Returns headerless 16-bit LE mono PCM, ready for the call core's audio source.
 * No extra npm deps: native `fetch` for the HTTP path and the built-in `WebSocket`
 * for streaming.
 *
 * @example
 * new InworldTTSAdapter({ apiKey: process.env.INWORLD_API_KEY!, voiceId: 'Ashley' })
 */
export class InworldTTSAdapter implements ITtsAdapter {
    readonly sampleRate: number

    private readonly apiKey: string
    private readonly voiceId: string
    private readonly model: string
    private readonly speakingRate?: number
    private readonly language?: string
    private readonly baseUrl: string
    private readonly wsBaseUrl: string
    private readonly normalization: InworldTextNormalization
    private readonly deliveryMode?: InworldDeliveryMode
    private readonly conversationContext: boolean
    private readonly streamTimeoutMs: number
    /** Text of the last synthesized turns, for `synthesisContext`. */
    private recent: string[] = []

    constructor(options: InworldTTSAdapterOptions) {
        if (!options.apiKey) throw new Error('[InworldTTSAdapter] apiKey is required. Get it at inworld.ai')
        if (!options.voiceId) throw new Error('[InworldTTSAdapter] voiceId is required. See List voices in the docs')

        this.apiKey = options.apiKey
        this.voiceId = options.voiceId
        this.model = options.model ?? InworldTTSModel.Tts2
        this.sampleRate = options.sampleRate ?? 48000
        this.speakingRate = options.speakingRate
        this.language = options.language
        this.baseUrl = REGIONS[(options.region ?? InworldRegion.Us).toLowerCase()] ?? INWORLD_API
        this.wsBaseUrl = (options.wsBaseUrl ?? this.baseUrl.replace(/^https:/, 'wss:')).replace(/\/+$/, '')
        this.normalization = options.normalization ?? 'ON'
        this.deliveryMode = options.deliveryMode
        this.conversationContext = options.conversationContext ?? false
        this.streamTimeoutMs = options.streamTimeoutMs ?? 5000
    }

    private async synthesizeChunk(text: string, signal?: AbortSignal): Promise<Buffer> {
        signal?.throwIfAborted()
        const previousRequests =
            this.conversationContext && this.recent.length
                ? { previousRequests: this.recent.map((t) => ({ text: t })) }
                : undefined

        const res = await fetch(`${this.baseUrl}/tts/v1/voice`, {
            method: 'POST',
            // A request that never returns would hold the turn open: bound it.
            signal: signal ?? AbortSignal.timeout(this.streamTimeoutMs),
            headers: {
                Authorization: `Basic ${this.apiKey}`,
                'Content-Type': 'application/json',
                // Reuse the TCP/TLS connection instead of handshaking on every turn.
                Connection: 'keep-alive',
            },
            body: JSON.stringify({
                text,
                voiceId: this.voiceId,
                modelId: this.model,
                audioConfig: {
                    audioEncoding: 'PCM', // headerless 16-bit LE
                    sampleRateHertz: this.sampleRate,
                    ...(this.speakingRate ? { speakingRate: this.speakingRate } : {}),
                },
                applyTextNormalization: this.normalization,
                ...(this.deliveryMode ? { deliveryMode: this.deliveryMode } : {}),
                ...(this.language ? { language: this.language } : {}),
                ...(previousRequests ? { synthesisContext: previousRequests } : {}),
            }),
        })

        if (!res.ok) {
            throw new Error(`[InworldTTSAdapter] ${res.status} ${res.statusText}: ${await res.text()}`)
        }

        const raw = await res.text()
        const data = JSON.parse(raw) as { audioContent?: string }
        if (!data.audioContent) {
            throw new Error(
                `[InworldTTSAdapter] no audioContent for ${JSON.stringify(text.slice(0, 80))} — response: ${raw.slice(0, 200)}`
            )
        }

        if (this.conversationContext) {
            this.recent.push(text)
            if (this.recent.length > CONTEXT_TURNS) this.recent.shift()
        }

        return Buffer.from(data.audioContent, 'base64')
    }

    /**
     * Synthesize speech over the non-streaming HTTP endpoint.
     * Splits automatically when the text exceeds the per-request limit.
     *
     * @param text Text to speak.
     * @returns Headerless 16-bit LE mono PCM at {@link sampleRate}.
     */
    async synthesize(text: string, options?: TtsSynthesisOptions): Promise<Buffer> {
        options?.signal?.throwIfAborted()
        if (!text?.trim()) return Buffer.alloc(0)

        const chunks = chunkText(text, TTS_MAX_CHARS)
        if (chunks.length === 1) return this.synthesizeChunk(chunks[0], options?.signal)

        const buffers: Buffer[] = []
        for (const chunk of chunks) buffers.push(await this.synthesizeChunk(chunk, options?.signal))
        return Buffer.concat(buffers)
    }

    /**
     * Synthesize over the bidirectional WebSocket, yielding PCM as it arrives so playback
     * can start with the first chunk instead of waiting for the whole sentence.
     *
     * Follows Inworld's low-latency pattern: create the context, send the text and close
     * WITHOUT waiting for the `contextCreated` acknowledgement (messages are processed in
     * order, so waiting only adds a network round trip).
     *
     * @param text Text to speak.
     * @param options `signal` to cancel (barge-in, hang-up) and `callId` to isolate contexts.
     */
    async *synthesizeStream(text: string, options?: TtsSynthesisOptions): AsyncIterable<Buffer> {
        const trimmed = text?.trim()
        if (!trimmed) return
        const signal = options?.signal
        signal?.throwIfAborted()

        const contextId = `ctx-${options?.callId ?? 'anon'}-${Date.now().toString(36)}`
        const socket = new WebSocket(`${this.wsBaseUrl}/tts/v1/voice:streamBidirectional`, {
            headers: { Authorization: `Basic ${this.apiKey}` },
        } as never)

        const queue: Buffer[] = []
        let finished = false
        let failure: Error | null = null
        /** Whether the server confirmed completion (`contextClosed` or `done`). */
        let completed = false
        let wake: (() => void) | null = null
        const notify = () => {
            wake?.()
            wake = null
        }
        const stop = (error?: Error) => {
            if (error && !failure) failure = error
            finished = true
            notify()
            try {
                socket.close()
            } catch {
                // already closed
            }
        }

        let opened = false
        // Two clocks: one to CONNECT (cleared on first activity) and one for IDLE time that
        // resets with every chunk. A single timer would cut long syntheses mid-stream.
        let connectTimer: ReturnType<typeof setTimeout> | null = setTimeout(
            () => stop(new Error(`[InworldTTSAdapter] WebSocket did not respond within ${this.streamTimeoutMs}ms`)),
            this.streamTimeoutMs
        )
        let idleTimer: ReturnType<typeof setTimeout> | null = null
        const clearConnectTimer = () => {
            if (!connectTimer) return
            clearTimeout(connectTimer)
            connectTimer = null
        }
        const armIdleTimer = () => {
            if (idleTimer) clearTimeout(idleTimer)
            idleTimer = setTimeout(
                () =>
                    stop(
                        new Error(
                            `[InworldTTSAdapter] WebSocket stopped sending audio (${this.streamTimeoutMs}ms idle)`
                        )
                    ),
                this.streamTimeoutMs
            )
        }

        const abort = () => stop()
        signal?.addEventListener('abort', abort, { once: true })

        socket.onopen = () => {
            opened = true
            clearConnectTimer()
            armIdleTimer()
            const create: WsCreatePayload = {
                voice_id: this.voiceId,
                model_id: this.model,
                // Same format and rate as the HTTP path: headerless 16-bit LE mono PCM.
                audio_config: { audio_encoding: 'PCM', sample_rate_hertz: this.sampleRate, bit_rate: 32000 },
            }
            socket.send(JSON.stringify({ context_id: contextId, create }))
            // One sentence per message with flush: the first audio comes out sooner.
            for (const sentence of splitSentences(trimmed)) {
                socket.send(JSON.stringify({ context_id: contextId, send_text: { text: sentence, flush_context: {} } }))
            }
            socket.send(JSON.stringify({ context_id: contextId, close_context: {} }))
        }

        socket.onmessage = (event: MessageEvent) => {
            let data: WsServerMessage
            try {
                data = JSON.parse(String(event.data)) as WsServerMessage
            } catch {
                return // non-JSON message: ignore
            }
            if (data.error) {
                stop(new Error(`[InworldTTSAdapter] WebSocket error: ${JSON.stringify(data.error)}`))
                return
            }
            const result = data.result
            if (!result) {
                if (data.done) {
                    completed = true
                    stop()
                }
                return
            }
            const audio = result.audioChunk?.audioContent
            if (audio) {
                clearConnectTimer()
                armIdleTimer()
                queue.push(Buffer.from(audio, 'base64'))
                notify()
            }
            if (result.contextClosed !== undefined) {
                completed = true
                stop()
            }
        }

        socket.onerror = () =>
            stop(
                new Error(
                    opened
                        ? '[InworldTTSAdapter] WebSocket interrupted during synthesis'
                        : '[InworldTTSAdapter] could not open the TTS WebSocket'
                )
            )
        socket.onclose = () => {
            // The server must confirm completion. Anything else (drop, clean close without the
            // completion signal, timeout) is an incomplete synthesis and is reported. Deciding
            // this from which event fired first made the outcome environment-dependent.
            stop(
                completed ? undefined : new Error('[InworldTTSAdapter] WebSocket closed before the synthesis completed')
            )
        }

        try {
            while (true) {
                const chunk = queue.shift()
                if (chunk) {
                    yield chunk
                    continue
                }
                if (failure) throw failure
                if (finished) return
                await new Promise<void>((resolve) => {
                    wake = resolve
                })
            }
        } finally {
            clearConnectTimer()
            if (idleTimer) clearTimeout(idleTimer)
            signal?.removeEventListener('abort', abort)
            try {
                socket.close()
            } catch {
                // already closed
            }
        }
    }
}
