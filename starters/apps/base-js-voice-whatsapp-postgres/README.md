# Voice WhatsApp starter — Meta Cloud API + BuilderBot

Starter that answers **inbound WhatsApp Business voice calls** using
`@builderbot/provider-meta` with the opt-in `enableVoiceCalls` flag.

```
Caller (WhatsApp)  ->  Meta Calling webhook (field: "calls", SDP offer)
                   ->  BuilderBot negotiates WebRTC (pre_accept + accept)
                   ->  STT (Whisper) -> `message` event -> your flow
                   ->  reply -> TTS -> audio back to the caller
```

Transcribed caller speech arrives as a normal `message`, so **your keyword flows
work unchanged**. Replies are synthesized to speech: media and buttons are not
supported on a voice call.

## Requirements

- A WhatsApp Business number on the **Cloud API** (not the WhatsApp Business app).
- **Calling enabled** for that number (WhatsApp Manager -> your number -> Calling).
- Your Meta app **subscribed to the `calls` webhook field**, pointing at
  `https://<your-host>/webhook`.
- An OpenAI API key (default Whisper STT + TTS adapters).

## Setup

```bash
cp .env.example .env    # fill in the values
npm install
npm run dev
```

## Environment

| Variable | Description |
| --- | --- |
| `META_JWT_TOKEN` | Meta system-user access token (Graph API) |
| `META_NUMBER_ID` | WhatsApp Business phone number ID |
| `META_VERIFY_TOKEN` | Webhook verification token you choose |
| `OPENAI_API_KEY` | Used by the default STT (Whisper) and TTS adapters |
| `STT_LANGUAGE` | ISO-639-1 language hint for transcription (e.g. `en`, `es`) |
| `PORT` | HTTP port (default `3008`) |

## Custom speech stack

Pass `sttAdapter` / `ttsAdapter` to `createProvider` to swap OpenAI for Deepgram,
ElevenLabs or Cartesia (all available in `@builderbot/provider-voice`).

## Notes

- Outbound calls and DTMF are not implemented yet.
- The bot answers **after the caller speaks** (there is no greeting on connect).
