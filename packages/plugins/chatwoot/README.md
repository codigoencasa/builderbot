<p align="center">
  <a href="https://builderbot.app/">
    <h2 align="center">@builderbot/plugin-chatwoot</h2>
  </a>
</p>

<p align="center">
  Syncs every WhatsApp conversation to <a href="https://www.chatwoot.com/">Chatwoot</a> automatically.<br/>
  Agents can reply directly from Chatwoot and their messages are forwarded to WhatsApp in real time.
</p>

---

## What it does

| Feature | Details |
|---|---|
| **Inbox auto-creation** | Creates an API-channel inbox on first run and reuses it on subsequent starts |
| **Contact sync** | Finds or creates the Chatwoot contact for every phone number |
| **Conversation sync** | Finds or creates the open conversation and caches it in memory |
| **Media attachments** | Images, audio, video and documents are sent as attachments in both directions |
| **Media-only messages** | WhatsApp media-only messages (no caption) are synced with a readable label (`[image]`, `[audio]`, `[file]`, …) |
| **Multiple attachments** | When an agent sends several files from Chatwoot, each one is forwarded to WhatsApp |
| **Bidirectional messages** | Bot outgoing messages → Chatwoot (outgoing) · User messages → Chatwoot (incoming) |
| **Agent replies** | Chatwoot agent messages → WhatsApp via webhook |
| **Blacklist integration** | When an agent takes a conversation, the user is added to the bot blacklist so the bot stops responding |
| **Webhook auto-registration** | Registers the webhook URL in Chatwoot and the HTTP route on the provider server automatically |
| **Group message filter** | `@g.us` group messages are silently ignored |
| **Startup validation** | Credentials are verified before anything runs; the plugin self-disables on failure |
| **Serialized API calls** | An internal queue ensures no race conditions against the Chatwoot API |

---

## Installation

```bash
pnpm add @builderbot/plugin-chatwoot
```

---

## Quick start

```ts
import { createBot, createProvider, createFlow, MemoryDB } from '@builderbot/bot'
import { BaileysProvider } from '@builderbot/provider-baileys'
import { createChatwootPlugin } from '@builderbot/plugin-chatwoot'

const chatwoot = createChatwootPlugin({
    token: 'YOUR_CHATWOOT_USER_TOKEN',
    url: 'https://app.chatwoot.com',
    accountId: 1,
    // Optional but recommended: enables agent → WhatsApp replies
    webhookUrl: 'https://your-bot.example.com/v1/chatwoot',
})

const bot = await createBot({
    flow: createFlow([...]),
    provider: createProvider(BaileysProvider),
    database: new MemoryDB(),
})

// One call wires everything up — including the webhook HTTP route
await chatwoot.attach(bot)
```

That's it. Every message exchanged through your bot is now mirrored in Chatwoot, and agent replies are forwarded back to WhatsApp automatically.

---

## Configuration

```ts
const chatwoot = createChatwootPlugin({
    /** User or Agent API access token from Chatwoot → Profile → Access Token */
    token: 'xxxxxxxxxxxxxxxxxxxxxxxx',

    /** Base URL of your Chatwoot instance */
    url: 'https://app.chatwoot.com',

    /** Numeric account ID visible in the Chatwoot URL */
    accountId: 1,

    /** Optional: custom inbox name (default: 'BuilderBot Inbox') */
    inboxName: 'WhatsApp Bot',

    /**
     * Optional: public URL where Chatwoot will POST webhook events.
     * When provided, the plugin registers (or reuses) the webhook on startup.
     * Required for agent replies to reach WhatsApp.
     */
    webhookUrl: 'https://your-bot.example.com/v1/chatwoot',
})
```

### How to get your token

1. Open Chatwoot → click your avatar (bottom-left) → **Profile Settings**
2. Scroll down to **Access Token** and copy it

### How to find your accountId

It is the number in the URL after `/app/accounts/`:
```
https://app.chatwoot.com/app/accounts/42/conversations
                                       ↑
                                   accountId = 42
```

---

## Receiving agent replies (webhook)

When a Chatwoot agent sends a message, Chatwoot fires a webhook to your bot. As long as you set `webhookUrl` in the config, `attach()` handles everything automatically — it registers the webhook in Chatwoot **and** wires the HTTP route on the provider's server.

```ts
import { createBot, createFlow, addKeyword } from '@builderbot/bot'
import { BaileysProvider } from '@builderbot/provider-baileys'
import { createChatwootPlugin } from '@builderbot/plugin-chatwoot'

const chatwoot = createChatwootPlugin({
    token: 'YOUR_TOKEN',
    url: 'https://app.chatwoot.com',
    accountId: 1,
    webhookUrl: 'https://your-bot.example.com/v1/chatwoot',
})

const bot = await createBot({
    flow: createFlow([...]),
    provider: createProvider(BaileysProvider, { name: 'bot' }),
    database: new MemoryDB(),
})

// Registers the Chatwoot account webhook AND the /v1/chatwoot HTTP route automatically
await chatwoot.attach(bot)
```

> **Note:** The URL you pass as `webhookUrl` must be reachable by your Chatwoot server.  
> For local development use [ngrok](https://ngrok.com/) or a similar tunnel.

### Advanced: manual route registration

If you use a custom HTTP server outside of BuilderBot's provider, you can still call `handleWebhook` directly:

```ts
myServer.post('/v1/chatwoot', async (req, res) => {
    await chatwoot.handleWebhook(bot, req.body)
    res.end(JSON.stringify({ status: 'ok' }))
})
```

### What `handleWebhook` handles

| Chatwoot event | Plugin action |
|---|---|
| `conversation_updated` — agent **assigned** | Adds the user's phone to the bot blacklist (bot stops responding) |
| `conversation_updated` — agent **unassigned** | Removes the phone from the blacklist (bot resumes) |
| `message_created` — outgoing on API channel | Forwards the agent's message (text + optional media) to WhatsApp |
| `message_created` — private note | Ignored — private notes are not forwarded |
| Event for a different inbox | Ignored — only events for the plugin's inbox are processed |

---

## How agent takeover works

```
Agent assigned to conversation
          │
          ▼
  phone added to blacklist ──► bot stops responding to that user
          │
  Agent types in Chatwoot
          │
          ▼
  handleWebhook receives message_created
          │
          ▼
  Message forwarded to WhatsApp

Agent unassigns from conversation
          │
          ▼
  phone removed from blacklist ──► bot resumes normally
```

---

## Advanced usage

### Accessing the Chatwoot API directly

```ts
const api = chatwoot.getApi()

// Create a contact manually
const contact = await api.findOrCreateContact('+5215511223344', 'John Doe')

// Send a message to an existing conversation
await api.sendMessage(conversationId, 'Hello from the API!', 'outgoing')

// Send a message with a media attachment
await api.sendMessage(conversationId, 'See attached', 'outgoing', 'https://example.com/image.png')
// Or from a local file:
await api.sendMessage(conversationId, 'See attached', 'outgoing', '/tmp/photo.jpg')
```

### Inspecting the active inbox

```ts
const inbox = chatwoot.getInbox()
console.log(inbox?.id, inbox?.name)
```

### Checking plugin health

```ts
if (!chatwoot.status) {
    console.warn('Chatwoot plugin is disabled — check your credentials')
}
```

---

## Environment variables (recommended)

Store sensitive values in a `.env` file instead of hardcoding them:

```env
CHATWOOT_TOKEN=your-access-token
CHATWOOT_URL=https://app.chatwoot.com
CHATWOOT_ACCOUNT_ID=1
CHATWOOT_WEBHOOK_URL=https://your-bot.example.com/v1/chatwoot
```

```ts
const chatwoot = createChatwootPlugin({
    token: process.env.CHATWOOT_TOKEN!,
    url: process.env.CHATWOOT_URL!,
    accountId: Number(process.env.CHATWOOT_ACCOUNT_ID),
    webhookUrl: process.env.CHATWOOT_WEBHOOK_URL,
})
```

---

## Supported media types

The plugin handles media in both directions.

### WhatsApp → Chatwoot

When an incoming WhatsApp message carries media, the file is attached to the Chatwoot message. The plugin resolves the media source through two strategies, tried in order:

1. **`options.media` URL** — used when the provider already exposes a public media URL in `payload.options.media`.
2. **`provider.saveFile` fallback** — used when the provider carries the raw message context (e.g. Baileys) but does not populate `options.media`. The plugin calls `bot.provider.saveFile(payload)` to download the file to a temporary path, uploads it to Chatwoot, then cleans up the temp file automatically. If the download fails the message is still forwarded with the readable label as caption.

If the message body is a provider event string, it is also converted to a human-readable caption that appears alongside the attachment:

| WhatsApp event | Label shown in Chatwoot |
|---|---|
| `_event_media_` | `[image]` |
| `_event_voice_note_` | `[audio]` |
| `_event_document_` | `[file]` |
| `_event_video_` | `[video]` |
| `_event_location_` | `[location]` |
| `_event_sticker_` | `[sticker]` |
| `_event_order_` | `[order]` |

### Chatwoot → WhatsApp

When an agent uploads files in Chatwoot, each attachment is forwarded as a separate WhatsApp message. The plugin detects the MIME type from the file extension when uploading local files:

| Extension | MIME type |
|---|---|
| `.jpg` / `.jpeg` | `image/jpeg` |
| `.png` | `image/png` |
| `.gif` | `image/gif` |
| `.webp` | `image/webp` |
| `.mp4` | `video/mp4` |
| `.pdf` | `application/pdf` |
| `.mp3` | `audio/mpeg` |
| `.ogg` / `.opus` | `audio/ogg` |
| `.wav` | `audio/wav` |
| `.svg` | `image/svg+xml` |
| other | `application/octet-stream` |

For remote URLs, the MIME type is taken from the HTTP `Content-Type` response header automatically.

---

## API reference

### `createChatwootPlugin(config)`

Creates the plugin instance. Returns a `ChatwootPlugin`.

### `chatwoot.attach(bot)`

Wires the plugin into the bot. Must be called once after `createBot`.

- Validates Chatwoot credentials (`checkAccount`)
- Finds or creates the API-channel inbox
- Registers the account webhook in Chatwoot if `webhookUrl` is configured
- Auto-registers the HTTP route on `provider.server` if `webhookUrl` is configured
- Listens to `send_message` and `provider.message` events

### `chatwoot.handleWebhook(bot, body)`

Processes a raw webhook body sent by Chatwoot. Call this from your HTTP route handler.

### `chatwoot.getApi()`

Returns the underlying `ChatwootApi` instance for direct API calls.

### `chatwoot.getInbox()`

Returns the `ChatwootInbox` object (`{ id, name }`) or `null` before `attach()`.

### `chatwoot.status`

`true` while the plugin is operational. Set to `false` automatically if credentials fail.

---

## Links

- [BuilderBot documentation](https://builderbot.app/)
- [Chatwoot documentation](https://www.chatwoot.com/docs/)
- [💻 Discord](https://link.codigoencasa.com/DISCORD)
- [👌 𝕏 (Twitter)](https://twitter.com/leifermendez)
