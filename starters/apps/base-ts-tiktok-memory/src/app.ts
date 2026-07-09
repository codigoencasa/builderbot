import { createBot, createProvider, createFlow, addKeyword, MemoryDB as Database } from '@builderbot/bot'
import { TikTokProvider as Provider, tiktokEvents } from '@builderbot/provider-tiktok'

const PORT = process.env.PORT ?? 3008

/**
 * Lead-magnet style flow for organic TikTok comments.
 *
 * TikTok has no webhook and no comment→DM. The provider polls watched videos
 * and emits `tiktokEvents.TT_COMMENT`. Replies are always **public** under the
 * comment via `sendMessage` / `replyToComment`.
 *
 * Env:
 *   TIKTOK_ACCESS_TOKEN  — Business API access token
 *   TIKTOK_BUSINESS_ID   — open_id of the business account
 *   TIKTOK_VIDEO_IDS     — comma-separated video ids to watch
 */
const LEAD_KEYWORD = 'info'
const LEAD_REPLY =
    'Hey @{username}! Thanks for commenting — check your DMs… wait, TikTok only lets us reply here publicly 🙌 Drop us a DM with the word INFO to get the free guide.'

const commentFlow = addKeyword(tiktokEvents.TT_COMMENT).addAction(
    async (ctx, { provider, endFlow }) => {
        const text = (ctx.comment?.text ?? '').toLowerCase()
        const username = ctx.comment?.username || ctx.username || 'friend'

        if (LEAD_KEYWORD && !text.includes(LEAD_KEYWORD)) {
            console.info('[tiktok] comment ignored (no keyword match)', {
                from: ctx.from,
                text: ctx.comment?.text,
            })
            return endFlow()
        }

        const reply = LEAD_REPLY.replace('{username}', username)
        console.info('[tiktok] replying to comment', {
            commentId: ctx.comment?.id,
            videoId: ctx.comment?.videoId,
            from: ctx.from,
        })

        // Prefer explicit comment target; falls back to pendingComments map.
        await provider.sendMessage(ctx.from, reply, {
            comment: {
                id: ctx.comment?.id,
                videoId: ctx.comment?.videoId,
            },
        })

        return endFlow()
    }
)

const main = async () => {
    const videoIds = (process.env.TIKTOK_VIDEO_IDS ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)

    const adapterFlow = createFlow([commentFlow])
    const adapterProvider = createProvider(Provider, {
        accessToken: process.env.TIKTOK_ACCESS_TOKEN ?? 'YOUR_ACCESS_TOKEN',
        businessId: process.env.TIKTOK_BUSINESS_ID ?? 'YOUR_BUSINESS_ID',
        videos: videoIds.length ? videoIds : ['YOUR_VIDEO_ID'],
        name: 'tiktok-bot',
        port: Number(PORT),
    })
    const adapterDB = new Database()

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    // Manual public reply (useful for debugging without waiting for a poll).
    adapterProvider.server.post(
        '/v1/reply-comment',
        handleCtx(async (bot, req, res) => {
            const { videoId, commentId, message } = req.body ?? {}
            if (!videoId || !commentId || !message) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                return res.end(JSON.stringify({ error: 'videoId, commentId and message are required' }))
            }
            const result = await bot.provider.replyToComment(videoId, commentId, message)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ status: 'ok', result }))
        })
    )

    // Watch an extra video at runtime without restarting.
    adapterProvider.server.post(
        '/v1/watch',
        handleCtx(async (bot, req, res) => {
            const { videoId, createdAt } = req.body ?? {}
            if (!videoId) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                return res.end(JSON.stringify({ error: 'videoId is required' }))
            }
            bot.provider.watchVideo(videoId, createdAt)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ status: 'ok', videoId }))
        })
    )

    httpServer(+PORT)
    console.info(`[tiktok] listening on :${PORT} — watching ${videoIds.length || 0} video(s)`)
}

main()
