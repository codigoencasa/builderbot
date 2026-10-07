# Voice AI starter — WhatsApp calls + LLM (Meta Cloud API)

Starter that answers **inbound WhatsApp Business voice calls** with an **LLM**
behind the conversation, using `@builderbot/provider-meta`
(`enableVoiceCalls`) + the OpenAI SDK.

```
Caller speaks -> STT (Whisper) -> catch-all flow -> LLM -> reply -> TTS -> caller
```

## How the AI flow works

- `addKeyword('/.*/', { regex: true })` is a **catch-all**: every transcribed
  utterance matches it.
- The conversation history is stored per caller in `state` (persisted by the
  configured database adapter).
- The LLM answer is sent with `flowDynamic`, which the provider synthesizes to
  speech while the call is active.

Tune it with `SYSTEM_PROMPT` and `OPENAI_MODEL`.

## Requirements

- WhatsApp Business number on the **Cloud API** + **Calling enabled**.
- Meta app subscribed to the **`calls`** webhook field.
- OpenAI API key (STT + TTS + LLM).

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
| `OPENAI_API_KEY` | STT + TTS + LLM |
| `STT_LANGUAGE` | ISO-639-1 language hint for transcription |
| `OPENAI_MODEL` | Chat model (default `gpt-4o-mini`) |
| `SYSTEM_PROMPT` | System prompt that defines the assistant |
| `PORT` | HTTP port (default `3008`) |

## Notes

- Keep answers short (1-2 sentences): it is a phone call, not a chat.
- Outbound calls and DTMF are not implemented yet.
- The bot answers **after the caller speaks** (there is no greeting on connect).
