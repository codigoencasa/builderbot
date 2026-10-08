# Voice AI starter — WhatsApp calls + LLM (Meta Cloud API)

Starter that answers **inbound WhatsApp Business voice calls** with an **LLM**
behind the conversation, using `@builderbot/provider-meta`
(`enableVoiceCalls`) + the OpenAI SDK.

```text
Caller speaks -> STT (Whisper) -> catch-all flow -> LLM -> reply -> TTS -> caller
```

## How the AI flow works

- `addKeyword('/.*/', { regex: true })` is a **catch-all**: every transcribed
  utterance matches it.
- The conversation history is stored per caller in `state` (persisted by the
  configured database adapter), so the LLM keeps context across turns.
- The answer is sent with `flowDynamic`, which the provider synthesizes to speech
  while the call is active.
- Tune it with `SYSTEM_PROMPT` and `OPENAI_MODEL`.

## Requirements

1. A **WhatsApp Business number on the Cloud API** (not the WhatsApp Business app).
2. **Calling enabled** for that number: WhatsApp Manager -> *Phone numbers* ->
   your number -> *Calling* -> enable. The number needs at least a
   **2,000 business-initiated conversation limit** (sandbox numbers are exempt).
3. Your Meta app **subscribed to the `calls` webhook field**, pointing at a
   **public HTTPS URL** (`https://<your-host>/webhook`).
4. An **OpenAI API key** (Whisper for speech-to-text and TTS for the replies).
5. Node.js 18+ and pnpm/npm.

## Setup, in order

1. **Enable Calling** on the number (step 2 above) and **subscribe the app to the
   `calls` field** (step 3). Both live in the Meta dashboards, not in this code.
2. **Create the project and install dependencies.**
   ```bash
   cp .env.example .env
   npm install
   ```
3. **Fill in `.env`** (see the table below). `META_VERIFY_TOKEN` is any secret
   string you choose; it must match the value in the Meta App Dashboard.
4. **Expose the webhook** with a public HTTPS URL and point Meta at
   `https://<your-host>/webhook` (same URL for messages and calls).
   ```bash
   npx ngrok http 3008   # local development only
   ```
5. **Run the bot.**
   ```bash
   npm run dev
   ```
   Wait for the `ready` event: the webhook server is listening.
6. **Place a real call** to the business number from the WhatsApp app and speak.
   Your transcript arrives as a normal `message`; the reply is spoken back.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `META_JWT_TOKEN` | ✅ | Meta system-user access token (Graph API) |
| `META_NUMBER_ID` | ✅ | WhatsApp Business phone number ID (numeric) |
| `META_VERIFY_TOKEN` | ✅ | Webhook verification token you choose |
| `OPENAI_API_KEY` | ✅ | Whisper (STT) + TTS (and the LLM in the AI starter) |
| `STT_LANGUAGE` | | ISO-639-1 transcription hint, e.g. `en`, `es` |
| `PORT` | | HTTP port (default `3008`) |
| `OPENAI_MODEL` | | Chat model (default `gpt-4o-mini`) |
| `SYSTEM_PROMPT` | | System prompt that defines the assistant |

## Voice options

Everything below is optional; the defaults are shown.

| Option | Default | Description |
|---|---|---|
| `greetingMessage` | — | Spoken as soon as the call is active. Without it the bot waits for the caller to speak first |
| `bargeIn` | `true` | Stop the bot's audio as soon as the caller starts talking |
| `bargeInMinSpeechMs` | `120` | Continuous speech required before barge-in cuts the audio (noise guard) |
| `language` | `STT_LANGUAGE` | ISO-639-1 STT hint |
| `silenceMs` | `800` | Trailing silence that closes an utterance |
| `silenceThreshold` | `0.015` | RMS (0..1) below which a frame counts as silence |
| `sttAdapter` / `ttsAdapter` | OpenAI | Custom speech stack (both required to skip `openaiApiKey`) |

## Events

| Event | Payload | When |
|---|---|---|
| `call_active` | `{ callId, from, to, direction }` | Media path open — the first moment the caller hears audio |
| `call_ended` | `{ callId, from }` | The call was released |
| `call_status` | `{ callId, status, timestamp, recipientId? }` | `RINGING`/`ACCEPTED`/`REJECTED` (business-initiated only) |
| `playback_interrupted` | `{ callId, from }` | Barge-in cut the bot's audio |

```ts
adapterProvider.on('call_active', ({ from }) => console.info('[call] active', from))
adapterProvider.on('call_ended', ({ callId }) => console.info('[call] ended', callId))
```

## Notes and limitations

- **Inbound only**: business-initiated (outbound) calls are not implemented yet.
- **No DTMF**: Meta injects dialpad tones as RFC 4733 events in the RTP stream,
  which the WebRTC binding does not expose.
- **No PSTN**: WhatsApp Calling does not route to mobile/landline numbers.
- Media and buttons are **not supported** on a call — replies are text-to-speech.
- Without `greetingMessage` the bot answers **after the caller speaks**.
- Meta gives a **30–60 s window** to answer after the `connect` webhook.
- Keep answers short (1–2 sentences): it is a phone call, not a chat.
- Full reference: [`@builderbot/provider-meta`](https://www.npmjs.com/package/@builderbot/provider-meta)
  (requirements, options, troubleshooting).
