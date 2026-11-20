# create-builderbot

Scaffold a BuilderBot chatbot in TypeScript or JavaScript. Requires **Node.js 20+** and **Git**.
See the [official quickstart](https://www.builderbot.app/en/quickstart).

## Create a project

```bash
npm create builderbot@latest
# Or: pnpm create builderbot@latest
```

Choose a provider, database and language in the interactive prompts. To supply the selections directly, pass all three flags:

```bash
npm create builderbot@latest -- --provider=baileys --database=memory --language=ts
# pnpm forwards flags without npm's extra separator:
pnpm create builderbot@latest --provider=baileys --database=memory --language=ts
```

The CLI creates `base-<language>-<provider>-<database>` in the current directory. Use a new directory, not an existing bot.
Dependencies are not installed automatically:

```bash
cd base-ts-baileys-memory
npm install
npm run dev
```

Configure credentials in the generated `src/app.ts` or `src/app.js` before connecting a provider or database.
If the starter includes `.env.example`, follow its README; do not assume every starter loads `.env` files.

## Supported selections

| Flag | Values |
| --- | --- |
| `--language` | `ts`, `js` |
| `--database` | `memory`, `json`, `mongo`, `mysql`, `postgres`, `redis` |
| `--provider` | `baileys`, `sherpa`, `evolution-api`, `wppconnect`, `twilio`, `meta`, `facebook-messenger`, `instagram`, `tiktok`, `gupshup`, `gohighlevel`, `email`, `voice`, `voice-sip`, `voice-whatsapp`, `meta-voice-ai` |

**Gupshup supports only `--language=ts --database=memory`.** Available provider packages are not the same as available CLI starters; for example, Telegram is installed and configured separately.
Memory uses `MemoryDB` from `@builderbot/bot`; it does not require a separate database package and is not durable across restarts.

## Run the generated bot

| Language | Development | Production |
| --- | --- | --- |
| TypeScript | `npm run dev` | `npm run build` then `npm start` |
| JavaScript | `npm run dev` or `npm start` | `npm start` (no build script) |

Provider-specific README files take precedence for webhook, speech and TikTok setup. Never expose sample HTTP endpoints publicly without access controls.

## Documentation and support

- [BuilderBot documentation](https://www.builderbot.app/) — API, flows, providers and deployment.
- [AI-agent documentation index](https://www.builderbot.app/llms.txt).
- [Discord](https://link.codigoencasa.com/DISCORD).
