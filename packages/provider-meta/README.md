<p align="center">
  <a href="https://builderbot.app/">
    <h2 align="center">@builderbot/provider-meta</h2>
  </a>
</p>


## Documentation

Visit [builderbot](https://builderbot.app/) to view the full documentation.


## Link Preview (preview_url)

When sending text messages that contain a URL (`https://` or `http://`), WhatsApp can display a rich link preview. This provider enables it automatically.

### Auto-detection

If your message text contains a URL, `preview_url` is set to `true` automatically — no extra configuration needed:

```ts
await provider.sendText('+1234567890', 'Check https://example.com')
// preview_url = true (auto-detected)
```

This also works with `flowDynamic` — the auto-detection applies:

```ts
await flowDynamic('Visit https://example.com for details')
// preview_url = true (auto-detected)
```

### Explicit control

Use `sendMessage` options to override the auto-detection:

```ts
// Force preview ON (even without URL)
await provider.sendMessage('+1234567890', 'Hello', { preview_url: true })

// Force preview OFF (even with URL)
await provider.sendMessage('+1234567890', 'See https://example.com', { preview_url: false })
```

Or use `sendText` directly:

```ts
await provider.sendText('+1234567890', 'See https://example.com', null, false)
```


## Voice Calls (opt-in)

`provider-meta` can answer **inbound WhatsApp Business voice calls** on the same
number you already use for messages: it negotiates WebRTC/SDP with Meta,
transcribes the caller (STT), drives your normal flows, and speaks the replies
back (TTS). Disabled by default.

```text
Caller (WhatsApp)  ->  Meta Calling webhook (field: "calls", SDP offer)
                   ->  provider-meta negotiates WebRTC (pre_accept + accept)
                   ->  STT (Whisper) -> `message` event -> your flow
                   ->  reply -> TTS -> audio back to the caller
```

Because transcribed speech arrives as a normal `message`, **your existing
keyword flows work unchanged**.

### Requirements

- A **WhatsApp Business number on the Cloud API** (not the WhatsApp Business app).
- **Calling enabled** for that number (WhatsApp Manager -> your number -> Calling).
- The number must be **eligible for the Calling API**: at least a
  **2,000 business-initiated conversation limit** (sandbox / public test numbers
  are exempt).
- Your Meta app **subscribed to the `calls` webhook field**, pointing at a
  **public HTTPS URL** (`https://<your-host>/webhook`).
- Meta recommends prior experience with SIP/WebRTC infrastructure.
- An **OpenAI API key** (default Whisper STT + TTS), or your own
  `sttAdapter` + `ttsAdapter`.

### Setup, in order

1. **Enable Calling on the number.**
   WhatsApp Manager -> *Phone numbers* -> your number -> *Calling* -> enable.
   Meta requires the 2,000-conversation limit (sandbox numbers are exempt).
2. **Subscribe the app to the `calls` webhook field.**
   Meta App Dashboard -> *WhatsApp* -> *Configuration* -> *Webhook fields* ->
   subscribe to `calls`. Use the same callback URL as for messages
   (`https://<your-host>/webhook`); the provider already serves it.
3. **Install the provider.**
   ```bash
   pnpm add @builderbot/bot @builderbot/provider-meta
   ```
4. **Configure the provider** with `enableVoiceCalls: true` and `openaiApiKey`
   (or custom adapters) — see the snippet below.
5. **Run the bot** and confirm it emits `ready` (the webhook server is listening
   and the Meta handshake works).
6. **Place a real call** to your business number from the WhatsApp app and speak.
   The transcript arrives as a `message`; the reply is spoken back.

### Configuration

```ts
const adapterProvider = createProvider(Provider, {
    jwtToken: process.env.META_JWT_TOKEN,
    numberId: process.env.META_NUMBER_ID,
    verifyToken: process.env.META_VERIFY_TOKEN,
    version: 'v20.0',

    // ── Voice calls ──
    enableVoiceCalls: true,
    openaiApiKey: process.env.OPENAI_API_KEY,      // default Whisper (STT) + OpenAI TTS
    greetingMessage: 'Hello! How can I help you?', // optional: speak first
})
```

| Option | Required | Default | Description |
|---|---|---|---|
| `enableVoiceCalls` | ✅ to enable | `false` | Turns on the WhatsApp calling pipeline |
| `openaiApiKey` | ✅ unless custom adapters | — | Whisper (STT) + OpenAI TTS |
| `sttAdapter` / `ttsAdapter` | | — | Custom speech stack (provide **both** to skip `openaiApiKey`) |
| `language` | | — | ISO-639-1 STT hint, e.g. `es` |
| `greetingMessage` | | — | Spoken as soon as the call becomes active; without it the bot waits for the caller to speak first |
| `bargeIn` | | `true` | Stop the bot's audio as soon as the caller starts talking |
| `bargeInMinSpeechMs` | | `120` | Continuous speech required before barge-in cuts the audio (noise guard) |
| `silenceMs` | | `800` | Trailing silence that closes an utterance |
| `silenceThreshold` | | `0.015` | RMS (0..1) below which a frame counts as silence |
| `iceServers` | | Google STUN | ICE servers for the peer connection (add TURN for restrictive NATs) |
| `iceGatheringTimeoutMs` | | `2000` | Max wait for non-trickle ICE gathering before sending the SDP |

### Events

On top of the usual `message`, `notice` and `ready`, the voice pipeline emits:

| Event | Payload | When |
|---|---|---|
| `call_active` | `{ callId, from, to, direction }` | The media path is open — the first moment the caller can hear audio |
| `call_ended` | `{ callId, from }` | The call was released (hang-up, end, or peer failure) |
| `call_status` | `{ callId, status, timestamp, recipientId? }` | `RINGING` / `ACCEPTED` / `REJECTED` — business-initiated calls only |
| `playback_interrupted` | `{ callId, from }` | Barge-in cut the bot's audio |

```ts
adapterProvider.on('call_active', ({ from }) => bot.dispatch('CALL_GREETING', { from }))
adapterProvider.on('call_ended', ({ callId }) => console.info('[call] ended', callId))
adapterProvider.on('playback_interrupted', ({ callId }) => console.info('[call] interrupted', callId))
```

### How it integrates with flows

- Transcribed caller speech arrives as a normal `message`: `ctx.body` is the
  transcript, `ctx.audio` holds the raw PCM and `ctx.sampleRate` its rate.
- Replying with `flowDynamic` / `sendMessage` while the call is active synthesizes
  the text and streams it to the caller instead of sending a WhatsApp message.
- **Media and buttons are not supported on a call** — only text-to-speech. Passing
  them emits a `notice` and they are ignored.
- For free-form conversations (LLM) use a catch-all flow:
  `addKeyword('/.*/', { regex: true })`.

### Limitations

- **Inbound only**: business-initiated (outbound) calls are not implemented yet.
- **No DTMF**: Meta injects dialpad tones as RFC 4733 events inside the RTP
  stream, which the WebRTC binding does not expose yet.
- **No PSTN**: WhatsApp Calling does not route to mobile/landline numbers.
- Without `greetingMessage` the bot answers **after the caller speaks**.
- `call_status` is only sent by Meta for business-initiated calls.
- Meta gives a **30–60 s window** to answer after the `connect` webhook.

### Troubleshooting

| Symptom | Check |
|---|---|
| The call never reaches the bot | The app is subscribed to the `calls` field and the callback URL is a public HTTPS URL |
| Webhook responds `403` | `verifyToken` does not match the Meta App Dashboard |
| Webhook responds `401` | `appSecret` is set but `X-Hub-Signature-256` does not match |
| No audio in either direction | Calling is enabled on the number; the `pre_accept`/`accept` notices appear; a TURN server may be needed behind restrictive NATs |
| `openaiApiKey is required` at startup | Set `openaiApiKey`, or provide both `sttAdapter` and `ttsAdapter` |

### Deprecation note

This supersedes the standalone `@builderbot/provider-voice-whatsapp` package,
which is now deprecated in favor of this opt-in flag.

## Official Course

If you want to discover all the functions and features offered by the library you can take the course.
[View Course](https://app.codigoencasa.com/courses/builderbot?refCode=LEIFER)


## Contact Us
- [💻 Discord](https://link.codigoencasa.com/DISCORD)
- [👌 𝕏 (Twitter)](https://twitter.com/leifermendez)