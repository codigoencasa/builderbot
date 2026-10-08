# @builderbot/provider-voice

Realtime **voice** provider for [BuilderBot](https://builderbot.app) built on
[LiveKit](https://livekit.io) (WebRTC) + OpenAI.

The bot joins a LiveKit room as a participant. When someone speaks, the audio is
transcribed with **OpenAI Whisper** and emitted as a normal `message` — so your
existing keyword flows match it exactly like any text provider. The flow's text
replies are synthesized with **OpenAI TTS** and published back into the room as
an audio track.

## Install

```bash
pnpm add @builderbot/provider-voice
```

## Usage

```ts
import { createBot, createProvider, createFlow, addKeyword, MemoryDB } from '@builderbot/bot'
import { VoiceProvider } from '@builderbot/provider-voice'

const welcome = addKeyword(['hola', 'hello']).addAnswer('¡Hola! ¿En qué te ayudo?')

const provider = createProvider(VoiceProvider, {
    apiKey: process.env.LIVEKIT_API_KEY!,
    apiSecret: process.env.LIVEKIT_API_SECRET!,
    wsUrl: process.env.LIVEKIT_WS_URL!, // wss://<project>.livekit.cloud
    roomName: 'support',
    openaiApiKey: process.env.OPENAI_API_KEY!,
    language: 'es',
})

await createBot({ flow: createFlow([welcome]), database: new MemoryDB(), provider })
```

A browser client joins the same room with a token from the provider's
`GET /token?identity=<id>&room=<room>` endpoint, then speaks. The transcript
drives the flow; the answer is spoken back.

## Configuration (`IVoiceProviderArgs`)

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `apiKey` / `apiSecret` | ✅ | — | LiveKit API credentials |
| `wsUrl` | ✅ | — | LiveKit server websocket URL |
| `roomName` | ✅ | — | Room the bot joins |
| `openaiApiKey` | ✅ | — | OpenAI key for Whisper + TTS |
| `identity` | | `builderbot` | Bot identity in the room |
| `sttModel` | | `whisper-1` | Whisper transcription model |
| `ttsModel` | | `gpt-4o-mini-tts` | OpenAI TTS model |
| `ttsVoice` | | `alloy` | TTS voice |
| `language` | | — | ISO-639-1 hint for Whisper, e.g. `es` |
| `silenceMs` | | `800` | Silence that closes an utterance |
| `silenceThreshold` | | `0.015` | RMS (0..1) below which a frame is silence |

## WhatsApp Business calls (shared core)

This package also hosts the **shared Meta calling core** consumed by
`@builderbot/provider-meta` (opt-in through `enableVoiceCalls`) and by the
deprecated `@builderbot/provider-voice-whatsapp`:

- `MetaCallCoreVendor` — WebRTC/SDP negotiation plus the STT -> `message` -> TTS pipeline.
- `MetaCallClient` — Graph API `/calls` client (`pre_accept`, `accept`, `reject`, `terminate`, `connect`).
- `SilenceSegmenter`, SDP helpers and the audio utilities.

Most apps should **not** use it directly: prefer `@builderbot/provider-meta` with
`enableVoiceCalls: true`, which wires it into the normal provider (see its README
for the requirements and the ordered Meta setup).

If you do consume the core directly it takes `{ sttAdapter, ttsAdapter, config }`,
where `config` is an `IMetaCallCoreConfig`:

| Option | Default | Description |
|---|---|---|
| `jwtToken`, `numberId`, `version` | — | Meta Graph API credentials |
| `language` | — | ISO-639-1 STT hint |
| `greetingMessage` | — | Spoken as soon as the call becomes active |
| `bargeIn` | `true` | Cut the bot's audio when the caller starts talking |
| `bargeInMinSpeechMs` | `120` | Continuous speech required before barge-in |
| `silenceMs` | `800` | Trailing silence that closes an utterance |
| `silenceThreshold` | `0.015` | RMS below which a frame counts as silence |
| `iceServers` | Google STUN | ICE servers for the peer connection |
| `iceGatheringTimeoutMs` | `2000` | Non-trickle ICE gathering timeout |

Events: `message`, `notice`, `call_active`, `call_ended`, `call_status` and
`playback_interrupted`.

## Behavior & limitations

- **Replies are broadcast to the whole room.** `sendMessage`'s `userId` does not
  target an individual participant, and `options.media` / `options.buttons` are
  ignored (a `notice` is emitted if passed). Only text-to-speech is sent.
- **`GET /token` is unauthenticated.** It mints LiveKit join tokens for any
  caller. This is convenient for local dev/demos — **put it behind auth before
  production**, or mint tokens in your own backend instead.
- **Utterance detection is energy-based VAD** (silence threshold + `silenceMs`),
  not a trained voice-activity model. Runaway utterances are force-cut at 20s to
  bound memory and stay under Whisper's 25MB upload limit.
- **Whisper is non-streaming**: transcription happens on a complete utterance, so
  there is inherent latency proportional to utterance length. Utterances are
  processed in spoken order.
- If the incoming LiveKit audio stream errors, the bot stops consuming that
  track (no automatic re-subscribe yet).
