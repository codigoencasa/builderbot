<p align="center">
  <a href="https://builderbot.app/">
    <picture>
      <img src="https://builderbot.app/assets/thumbnail-vector.png" height="80">
    </picture>
    <h2 align="center">BuilderBot</h2>
  </a>
</p>

<p align="center">
  <a aria-label="NPM version" href="https://www.npmjs.com/package/@builderbot/provider-tiktok">
    <img alt="" src="https://img.shields.io/npm/v/@builderbot/provider-tiktok?color=%2300c200&label=%40builderbot%2Fprovider-tiktok">
  </a>
  <a aria-label="Join the community on GitHub" href="https://link.codigoencasa.com/DISCORD">
    <img alt="" src="https://img.shields.io/discord/915193197645402142?logo=discord">
  </a>
</p>

## TikTok Provider

This provider connects your BuilderBot chatbot to **TikTok Business organic comments**: it watches videos for new
comments and lets your flows reply publicly under them.

> **Important — read before you build a lead magnet on this**
>
> TikTok's Business API does **not** offer webhooks for organic comments, and there is **no** "comment triggers a
> DM" capability (unlike Instagram/Meta). This provider works by **polling** `GET /business/comment/list/` on an
> adaptive schedule and can only reply **publicly** via `POST /business/comment/reply/create/`. Expect **1–5
> minutes of latency**, not real-time — this is the same approach used by social listening platforms (Sprinklr,
> Sprout Social) since TikTok gives nobody a webhook for this.
>
> TikTok Business Messaging (real DMs) is a **separate, region-locked** product (not available in US/EEA/UK/CH) and
> is **not** implemented by this provider.

## Installation

```bash
npm install @builderbot/provider-tiktok
```

## Configuration

Before using this provider, you need to:

1. Create an app at the [TikTok for Business Developer Portal](https://business-api.tiktok.com/portal/apps)
2. Activate the **Business Account API** product for your app
3. Complete OAuth for your TikTok Business account to get an `access_token` and the account's `business_id`
   (a.k.a. `open_id`)
4. Make sure the `comment.list` and `comment.list.manage` scopes are approved
5. Collect the video ids you want to watch for comments (auto-discovery via `video.list` requires that extra scope)

## Usage

```typescript
import { createBot, createProvider, createFlow, addKeyword } from '@builderbot/bot'
import { TikTokProvider, tiktokEvents } from '@builderbot/provider-tiktok'

const main = async () => {
    const provider = createProvider(TikTokProvider, {
        accessToken: 'YOUR_ACCESS_TOKEN',
        businessId: 'YOUR_BUSINESS_ID', // open_id
        videos: [
            '7258231412594101531', // bare video id
            { id: '7300000000000000000', createdAt: '2026-07-01T00:00:00Z' }, // enables adaptive polling
        ],
    })

    const commentFlow = addKeyword(tiktokEvents.TT_COMMENT).addAction(async (ctx, { provider }) => {
        // ctx.comment: { id, videoId, parentId, username, text }
        await provider.sendMessage(ctx.from, `Thanks for the comment, @${ctx.comment.username}!`)
    })

    await createBot({
        flow: createFlow([commentFlow]),
        provider,
        database: // your database adapter
    })
}

main()
```

## Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `accessToken` | string | Yes | - | TikTok Business API access token (`Access-Token` header) |
| `businessId` | string | Yes | - | TikTok Business account id (`open_id`) that owns the videos |
| `videos` | `(string \| { id, createdAt? })[]` | No | `[]` | Video ids to watch; add more later with `watchVideo()` |
| `version` | string | No | `v1.3` | TikTok Business API version |
| `pollIntervalMs` | number | No | `60000` | Poll interval used when a video's `createdAt` is unknown |
| `maxRetries` | number | No | `5` | Max retry attempts on HTTP 429 before giving up |
| `maxTrackedComments` | number | No | `5000` | Safety cap on tracked comment ids per video |
| `port` | number | No | `3000` | Port for the HTTP server (unused for webhooks, kept for parity) |
| `name` | string | No | `tiktok-bot` | Name identifier for the bot |

## How comment detection works (adaptive polling)

Since TikTok does not push comment events, the provider polls each watched video on a schedule based on its age —
the same pattern used by TikTok social-listening tools:

- Video published **<1h ago** → poll every **60s**
- Video published **<24h ago** → poll every **5 min**
- Video published **<7 days ago** → poll every **30 min**
- Older, or unknown `createdAt` → falls back to `pollIntervalMs` (default 60s)

On the **first** poll of a video, the provider only builds a baseline of existing `comment_id`s — it does not emit
events for a video's entire comment history the moment you start watching it. From the second poll onward, only
genuinely new comments are emitted as `tiktokEvents.TT_COMMENT`.

Requests are retried with exponential backoff + jitter on rate limiting (HTTP 429 or API code `40100`), honoring the
`Retry-After` header when present.

## Available Methods

### watchVideo(videoId, createdAt?)
Start (or restart) polling a video at runtime, in addition to the ones passed in the constructor.

### stopWatching(videoId?)
Stop polling a specific video, or all videos if no id is given.

### listComments(videoId, cursor?)
Fetch a single page of comments via `GET /business/comment/list/`. Mostly useful for debugging; the poller calls
this internally.

### replyToComment(videoId, commentId, text)
Post a **public** reply under a comment via `POST /business/comment/reply/create/`.

```typescript
await provider.replyToComment(ctx.comment.videoId, ctx.comment.id, 'Thanks for your comment!')
```

### sendMessage(userId, message, options?)
Convenience wrapper around `replyToComment`: routes to the last comment seen for `userId` (tracked internally),
or to `options.comment = { id, videoId }` if given explicitly. Because TikTok has no DM API for organic comments,
this **always** results in a public reply — never a private message.

### saveFile()
No-op kept for interface parity — TikTok organic comments don't carry downloadable media.

## `ctx.comment` shape

```typescript
{
    body: tiktokEvents.TT_COMMENT,
    from: 'user_id_or_username',
    name: 'display name or username',
    username: 'username',
    comment: {
        id: '123456',       // Comment id
        videoId: '789012',  // Video id the comment belongs to
        parentId: null,     // Parent comment id (if it's a reply to another comment)
        username: 'user123',
        text: 'comment text',
    },
}
```

## Documentation

Visit [builderbot.app](https://builderbot.app/) to view the full documentation.

## Official Course

If you want to discover all the functions and features offered by the library you can take the course.
[View Course](https://app.codigoencasa.com/courses/builderbot?refCode=LEIFER)

## Contact Us
- [💻 Discord](https://link.codigoencasa.com/DISCORD)
- [👌 𝕏 (Twitter)](https://twitter.com/leifermendez)
