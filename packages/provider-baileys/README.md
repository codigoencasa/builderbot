<p align="center">
  <a href="https://builderbot.app/">
    <h2 align="center">@builderbot/provider-baileys</h2>
  </a>
</p>


## Documentation

Visit [builderbot](https://builderbot.app/) to view the full documentation.

## Shutdown and session safety

By default, `captureProcessSignals` is `false`: the application owns its process
signals. Call `await provider.destroy()` in your shutdown handler. It cancels
pending reconnects, waits for initialization and socket shutdown, flushes the LID
cache and logs, and closes the provider HTTP server. Concurrent calls share the
same shutdown promise. A destroyed provider cannot be started again; create a
new instance instead.

Standalone applications may opt into `captureProcessSignals: true`. The provider
then handles shutdown signals and exits after its cleanup completes. Do not opt
in when another component owns process shutdown.

`releaseSessionFiles()` and `timeRelease` only remove regular files in the reserved
`builderbot-temp-<id>.tmp` namespace. They preserve credentials, Signal keys, LID
mappings, caches and all unknown files. Authentication files are **not temporary
files** and must not be deleted to reclaim disk space.

Tests use separate temporary workspaces; they never clean application sessions or logs.

## Usernames and LID senders

WhatsApp users with a **username** are addressed by a LID (`<id>@lid`) instead of a
phone-number JID. Baileys surfaces the username fields (upstream PR #2480, present
since `rc13`), and the provider forwards them on the `message` event:

| Field | Meaning |
|---|---|
| `username` | Username of the chat counterpart, when WhatsApp sends it (`key.remoteJidUsername`) |
| `participantUsername` | Username of the group author, groups only (`key.participantUsername`) |

```ts
bot.on('message', async (ctx) => {
    // ctx.from may legitimately be a LID such as '122299361538159@lid'
    console.log(ctx.from, ctx.username, ctx.participantUsername)
})
```

**Important**

- Treat `from` as an **opaque, stable key**: it can be a `@lid`. Do not parse it as a
  phone number.
- In private chats WhatsApp often sends **only** the LID (`remoteJidAlt` and
  `remoteJidUsername` can both be `undefined`). Replying still works: the provider
  resolves LID→PN through the cache and `signalRepository.lidMapping`, and sends to
  the `@lid` directly when no PN mapping exists.
- Sending **to** a username is not supported by Baileys (the upstream lookup API was
  never merged): send to a PN or a LID.

## Group messages (opt-in)

Group messages are **off by default**. Enable them with `allowGroups: true`:

```ts
createBot({ /* ... */ }, { allowGroups: true })
```

When enabled:

- `from` is the group JID (`120363000000000000@g.us`)
- `participant` and `sender` carry the author JID
- `allowGroups` takes precedence over `groupsIgnore` **for groups only**;
  status broadcasts still follow `groupsIgnore`

Legacy `groupsIgnore` (default `true`) keeps ignoring groups and broadcasts when
`allowGroups` is not set.

## Live validation (manual, opt-in)

Automated tests mock Baileys, so they cannot catch packaging or protocol issues.
`scripts/live-smoke.cjs` links a real device and exercises the built provider:

```bash
pnpm --filter @builderbot/provider-baileys build
cd packages/provider-baileys

node scripts/live-smoke.cjs                        # QR pairing (NV1)
SEND=1 node scripts/live-smoke.cjs                 # + text and image (NV2/NV3)
PHASE=resume SEND=1 node scripts/live-smoke.cjs    # restart with saved creds + reconnect (NV4/NV5)
MEDIA=1 SEND=1 node scripts/live-smoke.cjs         # full outbound media batch
```

- Runs in its own temporary cwd (`/tmp/baileys-live-smoke` by default, override with
  `SMOKE_ROOT`); it never touches your application directories or sessions.
- Prints the QR to the terminal and to `<SMOKE_ROOT>/qr-blocks.log`; results land in
  `<SMOKE_ROOT>/result-<phase>.json`.
- Sends only to the linked account's own chat unless you set `DEST`. **Do not point it
  at third parties**: WhatsApp restricts accounts for cold outreach.
- It links a real device to your account — unlink it in WhatsApp afterwards.

## Multi-session deployments (memory)

Baileys `rc14` still creates one `AsyncLocalStorage` per socket and never
releases it (upstream [#2806](https://github.com/WhiskeySockets/Baileys/issues/2806),
fix PR [#2807](https://github.com/WhiskeySockets/Baileys/pull/2807) open).
Heap then grows with *sockets ever created*, including every reconnect.

Until upstream merges the fix:

- Prefer **one process per session** (process isolation).
- Recycle long-running processes after repeated reconnects (the provider logs a
  hint when `maxReconnectAttempts` is reached).
- A single-session bot is not meaningfully affected.

## Resilience options

- `baileysLogLevel` (default `'error'`): level of the internal Baileys pino logger.
  `'fatal'` restores the old silent behavior but hides decrypt failures (Bad MAC,
  No session).
- `clearAuthOnLogout` (default `false`): when WhatsApp logs the session out (401),
  auth files are **preserved** and an `auth_failure` event is emitted. Set `true`
  to wipe `<name>_sessions` and re-pair automatically (legacy behavior).
- `connectionReplaced` (440) never auto-reconnects: another live socket owns the
  session and retrying starts a tug-of-war that can escalate to a ban. An
  `auth_failure` event is emitted instead.
- Reconnects use exponential backoff (1s base, 30s cap) with ±20% jitter.
- Pairing codes are requested with the digits-only phone number, and socket
  listeners are attached before the pairing request resolves.


## Official Course

If you want to discover all the functions and features offered by the library you can take the course.
[View Course](https://app.codigoencasa.com/courses/builderbot?refCode=LEIFER)


## Contact Us
- [💻 Discord](https://link.codigoencasa.com/DISCORD)
- [👌 𝕏 (Twitter)](https://twitter.com/leifermendez)