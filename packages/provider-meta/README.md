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

`provider-meta` can handle inbound WhatsApp Business voice calls (WebRTC/SDP negotiation + speech-to-text/text-to-speech) via the shared `@builderbot/provider-voice` module. This is disabled by default.

```ts
const adapterProvider = createProvider(Provider, {
    jwtToken: process.env.META_JWT_TOKEN,
    numberId: process.env.META_NUMBER_ID,
    verifyToken: process.env.META_VERIFY_TOKEN,
    version: 'v20.0',
    // ── Voice calls ──
    enableVoiceCalls: true,
    openaiApiKey: process.env.OPENAI_API_KEY, // used by the default Whisper/TTS adapters
    // Optional overrides:
    // sttAdapter, ttsAdapter, language, silenceMs, silenceThreshold, iceServers, iceGatheringTimeoutMs
})
```

When a WhatsApp voice call connects, transcribed caller utterances arrive through the normal `message` event/flow with `ctx.audio` (PCM buffer) and `ctx.sampleRate` set; replying with `flowDynamic`/`sendMessage` while the call is active streams synthesized audio back to the caller instead of sending a text message.

This supersedes the standalone `@builderbot/provider-voice-whatsapp` package, which is now deprecated in favor of this opt-in flag.

### Webhook signature validation (optional)

Set `appSecret` (your Meta App Secret) to validate the `X-Hub-Signature-256` header on every incoming webhook request. Requests with a missing or invalid signature are rejected with `401`:

```ts
const adapterProvider = createProvider(Provider, {
    // ...
    appSecret: process.env.META_APP_SECRET,
})
```


## Official Course

If you want to discover all the functions and features offered by the library you can take the course.
[View Course](https://app.codigoencasa.com/courses/builderbot?refCode=LEIFER)


## Contact Us
- [💻 Discord](https://link.codigoencasa.com/DISCORD)
- [👌 𝕏 (Twitter)](https://twitter.com/leifermendez)