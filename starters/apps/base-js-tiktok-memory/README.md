# TikTok organic comments starter

Minimal BuilderBot example for **TikTok organic comments** (poll + public reply).

> TikTok has no comment webhook and no comment→DM. This bot polls watched videos and replies **publicly** under new comments.

## Setup

Use Node.js 20+ and Git, as in the [BuilderBot quickstart](https://www.builderbot.app/en/quickstart).
From your generated project directory:

```bash
npm install
```

Export these variables in the terminal that will run the bot (or configure your deployment environment).
`.env.example` is a reference: this starter does not automatically load `.env` files.

```bash
export TIKTOK_ACCESS_TOKEN='your_access_token'
export TIKTOK_BUSINESS_ID='your_open_id'
export TIKTOK_VIDEO_IDS='7258231412594101531'
```

## Run

```bash
npm run dev
```

For production, **TypeScript** starters use `npm run build` then `npm start`.
**JavaScript** starters use `npm start` directly; they have no build script.
Configure the selected database in `src/app.ts` or `src/app.js`; only Memory runs without an external database service or file configuration.
The HTTP port defaults to `3008` (`PORT` overrides it).

When someone comments on a watched video with the keyword `info`, the bot posts a public reply.

## Debug endpoints

| Method | Path | Body |
|--------|------|------|
| `POST` | `/v1/reply-comment` | `{ "videoId", "commentId", "message" }` |
| `POST` | `/v1/watch` | `{ "videoId", "createdAt?" }` |

Example:

```bash
curl -X POST http://localhost:3008/v1/reply-comment \
  -H 'Content-Type: application/json' \
  -d '{"videoId":"7258231412594101531","commentId":"COMMENT_ID","message":"Thanks!"}'
```

Do not expose these debug endpoints publicly without authentication, input validation and network restrictions.
Never commit access tokens, real `.env` values or session files.

## Docs

- Package: [`@builderbot/provider-tiktok`](https://www.npmjs.com/package/@builderbot/provider-tiktok)
- Site: [builderbot.app](https://www.builderbot.app/)
- AI-agent index: [llms.txt](https://www.builderbot.app/llms.txt)
