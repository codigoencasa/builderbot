# base-ts-tiktok-memory

Minimal BuilderBot example for **TikTok organic comments** (poll + public reply).

> TikTok has no comment webhook and no comment→DM. This bot polls watched videos and replies **publicly** under new comments.

## Setup

From the monorepo root (recommended while developing the provider):

```bash
# build the provider
pnpm --filter @builderbot/provider-tiktok build

# run the example (link workspace packages)
cd starters/apps/base-ts-tiktok-memory
pnpm install
```

Set env vars:

```bash
export TIKTOK_ACCESS_TOKEN='your_access_token'
export TIKTOK_BUSINESS_ID='your_open_id'
export TIKTOK_VIDEO_IDS='7258231412594101531'
```

## Run

```bash
pnpm run dev
# or
pnpm run build && pnpm start
```

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

## Docs

- Package: [`@builderbot/provider-tiktok`](../../../packages/provider-tiktok/README.md)
- Site: [builderbot.app](https://builderbot.app/)
