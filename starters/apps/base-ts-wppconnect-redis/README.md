# BuilderBot TypeScript starter

Your project is already generated. Configure it, install dependencies and start the bot; you do not need to run `create-builderbot` again here.
Use Node.js 20+ and Git. See the [official quickstart](https://www.builderbot.app/en/quickstart) and your provider's requirements.

## Configure and run

From this directory:

```bash
npm install
# Configure the provider and database in src/app.ts before starting.
npm run dev
```

`npm run dev` lints and runs `src/app.ts` with automatic restarts. Set up the provider connection (for example, scan Baileys' QR code or configure Meta credentials/webhooks) before sending a message.

Review the `createProvider(...)` and database constructor in `src/app.ts`:

- Replace placeholder credentials and configure the external service for the provider you selected.
- Memory needs no service but is not durable across process restarts. Other databases need the connection settings used by the generated constructor.
- Values read through `process.env` must be exported by your shell, container or process manager. This starter does **not** automatically load a `.env` file.
- If `.env.example` is present, use it as a variable reference; copying it to `.env` alone does not export its values. Never commit real credentials or session files.

Additional requirements for environment-driven starters:

| Provider | Required setup |
| --- | --- |
| `gohighlevel` | `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET`, `GHL_LOCATION_ID`; configure the GoHighLevel integration. |
| `voice` | `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_WS_URL`, `OPENAI_API_KEY`; a LiveKit room (`LIVEKIT_ROOM` defaults to `support`). |
| `voice-sip` | LiveKit and OpenAI credentials above, `SIP_PHONE_NUMBER`, `SIP_ALLOWED_IPS`; provision the SIP connection with your carrier. |

Provider package documentation on [npm](https://www.npmjs.com/search?q=%40builderbot%2Fprovider) describes its external setup. Never treat placeholder values as working credentials.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Lint and run TypeScript in development. |
| `npm run lint` | Check the project's source. |
| `npm run build` | Compile to `dist/app.js` with Rollup. |
| `npm start` | Run `dist/app.js`; build first. |

For production, configure credentials in the deployment environment, then run `npm run build` followed by `npm start`.
The HTTP port is `PORT`, defaulting to `3008`.

## Sample HTTP routes

Check `src/app.ts` for the routes actually included in this starter. The shared chat example defines:

| Method | Path | JSON body / purpose |
| --- | --- | --- |
| POST | `/v1/messages` | `number`, `message`, optional `urlMedia` — send a message. |
| POST | `/v1/register` | `number`, `name` — dispatch the registration flow. |
| POST | `/v1/samples` | `number` — dispatch the media sample flow. |
| POST | `/v1/blacklist` | `number`, `intent` (`add` or `remove`). |
| GET | `/v1/blacklist/list` | List blocked numbers. |

These are demonstration endpoints, **not authenticated production APIs**. Add authentication, input validation and network restrictions before exposing them; a public provider webhook is a separate concern.

## Documentation and support

- [BuilderBot documentation](https://www.builderbot.app/), [flow methods](https://www.builderbot.app/en/methods) and [deployment](https://www.builderbot.app/en/deploy).
- [AI-agent documentation index](https://www.builderbot.app/llms.txt) — read before proposing API changes; verify examples against your installed package versions.
- [Discord](https://link.codigoencasa.com/DISCORD).
