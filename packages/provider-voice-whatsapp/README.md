# @builderbot/provider-voice-whatsapp

WhatsApp Business voice call provider for BuilderBot. Accepts inbound calls via the Meta Graph API, negotiates WebRTC/SDP, transcribes speech with STT, and synthesizes replies with TTS — all through the standard BuilderBot flow interface.

## How it works

```
User (WhatsApp)          Meta Graph API           Your server (BuilderBot)
      |                        |                          |
      |  Places a voice call   |                          |
      |----------------------->|                          |
      |                        |  POST /webhook           |
      |                        |  { field: "calls",       |
      |                        |    event: "connect",     |
      |                        |    from: "+1555...",     |
      |                        |    session: { sdp } }    |
      |                        |------------------------->|
      |                        |                          | 1. pre_accept + SDP answer
      |                        |<-------------------------|
      |                        |                          | 2. accept
      |                        |<-------------------------|
      |   WebRTC audio (Opus)  |                          |
      |----------------------->|------------------------->|
      |                        |                          | 3. SilenceSegmenter
      |                        |                          | 4. STT (Whisper) -> text
      |                        |                          | 5. emit("message") -> flow
      |                        |                          |
      |                        |                          | 6. flow replies via sendMessage
      |                        |                          | 7. TTS -> PCM -> WebRTC
      |   Audio response       |                          |
      |<-----------------------|<-------------------------|
```

The caller speaks — the bot responds with voice. Your existing keyword flows work without any changes.

## Requirements

- Node.js 18+
- A Meta Developer App with WhatsApp Business product
- A WhatsApp Business Account (WABA) with **Calling API enabled**
- A publicly accessible webhook URL (use ngrok for local development)
- OpenAI API key (for default STT/TTS) or custom adapters

## Installation

```bash
pnpm add @builderbot/provider-voice-whatsapp
```

## Quick start

```ts
import { createBot, createProvider, createFlow, addKeyword } from '@builderbot/bot'
import { JsonFileDB as Database } from '@builderbot/database-json'
import { WhatsAppVoiceProvider } from '@builderbot/provider-voice-whatsapp'

const welcomeFlow = addKeyword(['hola', 'hi', 'hello'])
    .addAnswer('Hello! How can I help you?')

const main = async () => {
    const provider = createProvider(WhatsAppVoiceProvider, {
        jwtToken: process.env.META_JWT_TOKEN,
        numberId: process.env.META_NUMBER_ID,
        verifyToken: process.env.META_VERIFY_TOKEN,
        version: 'v20.0',
        openaiApiKey: process.env.OPENAI_API_KEY,
    })

    await createBot({
        flow: createFlow([welcomeFlow]),
        provider,
        database: new Database({ filename: 'db.json' }),
    })
}

main()
```

## Configuration

```ts
createProvider(WhatsAppVoiceProvider, {
    // Required — Meta credentials
    jwtToken: 'your-meta-system-user-token',
    numberId: 'your-phone-number-id',       // Numeric ID, not the phone number itself
    verifyToken: 'any-secret-string',        // Must match what you set in Meta dashboard
    version: 'v20.0',                        // Meta Graph API version

    // Required unless custom adapters are provided
    openaiApiKey: 'sk-...',

    // Optional — server
    port: 3008,                              // Default: 3000

    // Optional — audio tuning
    language: 'es',                          // STT language hint (ISO-639-1). Default: 'en'
    silenceMs: 800,                          // Trailing silence (ms) to close an utterance. Default: 800
    silenceThreshold: 0.015,                 // RMS amplitude below which a frame is silence (0..1). Default: 0.015

    // Optional — WebRTC
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],

    // Optional — custom STT/TTS adapters (see Adapters section)
    sttAdapter: new MySTTAdapter(),
    ttsAdapter: new MyTTSAdapter(),
})
```

### Adapter combinations

| `openaiApiKey` | `sttAdapter` | `ttsAdapter` | Result |
|---|---|---|---|
| Required | — | — | Default OpenAI Whisper + TTS |
| Required | Provided | — | Custom STT + OpenAI TTS |
| Required | — | Provided | OpenAI Whisper + Custom TTS |
| Optional | Provided | Provided | Both custom — no OpenAI needed |

## Meta setup

### 1. Get your credentials

In [developers.facebook.com](https://developers.facebook.com):

- **`jwtToken`**: App Dashboard → WhatsApp → API Setup → System User Token (permanent token recommended)
- **`numberId`**: App Dashboard → WhatsApp → API Setup → Phone Number ID (the numeric field, not the phone number)
- **`verifyToken`**: Any string you choose — you will enter the same value in the webhook configuration

### 2. Enable Calling

WhatsApp Business Calling API must be explicitly enabled for your WABA. Contact Meta or your Business Solution Provider to request access.

### 3. Configure the webhook

In App Dashboard → WhatsApp → Configuration → Webhook:

- **Callback URL**: `https://your-domain.com/webhook`
- **Verify Token**: same value as `verifyToken` in your config
- **Subscriptions**: enable `messages` and `calls`

For local development with ngrok:

```bash
ngrok http 3008
# Use the https URL ngrok gives you as your Callback URL
```

### 4. Environment variables

```env
META_JWT_TOKEN=your-system-user-token
META_NUMBER_ID=123456789012345
META_VERIFY_TOKEN=my-secret-verify-token
OPENAI_API_KEY=sk-...
PORT=3008
```

## Webhook payload reference

Meta sends this payload to `POST /webhook` when a call arrives:

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WABA_ID",
    "changes": [{
      "field": "calls",
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "12345678900",
          "phone_number_id": "PHONE_NUMBER_ID"
        },
        "contacts": [{
          "profile": { "name": "John Doe" },
          "wa_id": "15551234567"
        }],
        "calls": [{
          "id": "CALL_ID",
          "from": "15551234567",
          "to": "12345678900",
          "event": "connect",
          "timestamp": "1762216151",
          "direction": "USER_INITIATED",
          "session": {
            "sdp": "<SDP_OFFER_STRING>",
            "sdp_type": "offer"
          }
        }]
      }
    }]
  }]
}
```

### Call events

| `event` | Description | `session` present |
|---|---|---|
| `connect` | Inbound call arriving — SDP offer included | Yes |
| `terminate` | Call ended by the user or timed out | No |

### Call flow (server-side actions)

When a `connect` event arrives, the provider automatically:

1. Creates a WebRTC `RTCPeerConnection`
2. Sets the remote SDP offer from `session.sdp`
3. Creates an SDP answer (forces codec to **Opus**, sets `a=setup:active`)
4. Sends `pre_accept` to Meta with the SDP answer
5. Sends `accept` to Meta
6. Wires inbound audio: `RTCAudioSink` → `SilenceSegmenter` → STT → `message` event

## Pluggable STT/TTS adapters

Swap speech providers without changing your flows.

### STT adapter interface

```ts
import type { ISttAdapter } from '@builderbot/provider-voice-whatsapp'

class MySTTAdapter implements ISttAdapter {
    async transcribe(audio: Buffer, sampleRate: number, language?: string): Promise<string> {
        // audio is raw 16-bit signed little-endian PCM, mono
        // return the transcribed text
        return 'transcribed text'
    }
}
```

### TTS adapter interface

```ts
import type { ITtsAdapter } from '@builderbot/provider-voice-whatsapp'

class MyTTSAdapter implements ITtsAdapter {
    async synthesize(text: string, language?: string): Promise<Buffer> {
        // return raw 16-bit signed little-endian PCM, mono, 24kHz
        return pcmBuffer
    }
}
```

### Example with Deepgram STT + ElevenLabs TTS

```ts
createProvider(WhatsAppVoiceProvider, {
    jwtToken: process.env.META_JWT_TOKEN,
    numberId: process.env.META_NUMBER_ID,
    verifyToken: process.env.META_VERIFY_TOKEN,
    version: 'v20.0',
    sttAdapter: new DeepgramSTTAdapter({ apiKey: process.env.DEEPGRAM_API_KEY }),
    ttsAdapter: new ElevenLabsTTSAdapter({ apiKey: process.env.ELEVENLABS_API_KEY }),
})
```

## Accessing the audio buffer

Each `message` event includes the raw PCM audio in `ctx.audio`. You can save it as a WAV file:

```ts
const flow = addKeyword(['*'])
    .addAction(async (ctx, { provider }) => {
        // Save the utterance to disk
        const path = await provider.saveFile(ctx, { path: '/tmp/recordings' })
        console.log('Saved to:', path)
    })
    .addAnswer('Got it!')
```

`saveFile` wraps the raw PCM in a standard RIFF/WAV container and writes it to the given directory (defaults to `os.tmpdir()`).

## Exported types and enums

```ts
import {
    WhatsAppVoiceProvider,

    // Enums
    CallEvent,      // 'connect' | 'terminate'
    CallAction,     // 'pre_accept' | 'accept' | 'reject' | 'end' | 'call'
    CallDirection,  // 'USER_INITIATED' | 'BUSINESS_INITIATED'
    CallState,      // 'idle' | 'connecting' | 'pre_accepted' | 'accepted' | 'active' | 'terminated'

    // Types
    IWhatsAppVoiceProviderArgs,
    WhatsAppVoicePayload,
    WhatsAppCallWebhookPayload,
    WhatsAppCallEntry,
    WhatsAppCallValue,
    WhatsAppCallEntryEvent,
    WhatsAppCallSession,
    CallActionBody,
    ISttAdapter,
    ITtsAdapter,
} from '@builderbot/provider-voice-whatsapp'
```

## Simulating a webhook locally

Use this `curl` command to simulate an inbound call without a real WhatsApp call:

```bash
curl -X POST http://localhost:3008/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "TEST_WABA_ID",
      "changes": [{
        "field": "calls",
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "12345678900",
            "phone_number_id": "TEST_PHONE_ID"
          },
          "contacts": [{ "profile": { "name": "Test User" }, "wa_id": "15551234567" }],
          "calls": [{
            "id": "test-call-id-001",
            "from": "15551234567",
            "to": "12345678900",
            "event": "connect",
            "timestamp": "1762216151",
            "direction": "USER_INITIATED",
            "session": {
              "sdp": "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nc=IN IP4 0.0.0.0\r\na=rtpmap:111 opus/48000/2\r\na=setup:actpass\r\na=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00\r\n",
              "sdp_type": "offer"
            }
          }]
        }
      }]
    }]
  }'
```

## Architecture

```
WhatsAppVoiceProvider (extends ProviderClass)
    |
    +-- WhatsAppCallCoreVendor (extends EventEmitter)
    |       |
    |       +-- MetaCallClient        — pre_accept / accept / end via Graph API
    |       +-- RTCPeerConnection     — one per active call (@roamhq/wrtc)
    |       +-- RTCAudioSink          — receives inbound Opus frames as PCM
    |       +-- SilenceSegmenter      — detects utterance boundaries
    |       +-- ISttAdapter           — speech-to-text (default: OpenAI Whisper)
    |       +-- RTCAudioSource        — pushes TTS PCM back to caller
    |       +-- ITtsAdapter           — text-to-speech (default: OpenAI TTS)
    |
    +-- polka HTTP server
            |
            +-- GET  /webhook         — Meta hub.verify_token handshake
            +-- POST /webhook         — inbound call events
```

## Limitations (v0.0.1)

- Inbound calls only — outbound calls not supported yet
- One audio track per call — no multi-party calls
- No DTMF support
- Media and image attachments are not supported via `sendMessage` (voice only)
