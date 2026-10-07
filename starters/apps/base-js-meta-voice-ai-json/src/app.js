import { createBot, createProvider, createFlow, addKeyword } from '@builderbot/bot'
import { JsonFileDB as Database } from '@builderbot/database-json'
import { MetaProvider as Provider } from '@builderbot/provider-meta'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const SYSTEM_PROMPT =
    process.env.SYSTEM_PROMPT ??
    'You are a helpful phone assistant. Answer in one or two short sentences, in the caller language.'

const aiFlow = addKeyword('/.*/', { regex: true }).addAction(async (ctx, { flowDynamic, state }) => {
    const history = state.get('history') ?? [{ role: 'system', content: SYSTEM_PROMPT }]
    history.push({ role: 'user', content: ctx.body })

    const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        messages: history,
    })

    const reply = completion.choices[0]?.message?.content ?? 'Sorry, could you repeat that?'
    history.push({ role: 'assistant', content: reply })

    await state.update({ history })
    await flowDynamic(reply)
})


const main = async () => {
    const adapterFlow = createFlow([aiFlow])
    const adapterProvider = createProvider(Provider, {
    jwtToken: process.env.META_JWT_TOKEN ?? 'YOUR_META_JWT_TOKEN',
    numberId: process.env.META_NUMBER_ID ?? 'YOUR_META_NUMBER_ID',
    verifyToken: process.env.META_VERIFY_TOKEN ?? 'YOUR_META_VERIFY_TOKEN',
    version: 'v20.0',
    // WhatsApp Business voice calls (inbound): WebRTC/SDP negotiation + STT/TTS.
    // Transcribed caller speech arrives as a normal `message`, so flows work as-is.
    enableVoiceCalls: true,
    openaiApiKey: process.env.OPENAI_API_KEY ?? 'YOUR_OPENAI_API_KEY',
    language: process.env.STT_LANGUAGE ?? 'en',
})

    
    const adapterDB = new Database({ filename: 'db.json' })

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    adapterProvider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const { number, message, urlMedia } = req.body
            await bot.sendMessage(number, message, { media: urlMedia ?? null })
            return res.end('sended')
        })
    )

    adapterProvider.server.post(
        '/v1/register',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('REGISTER_FLOW', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/samples',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('SAMPLES', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/blacklist',
        handleCtx(async (bot, req, res) => {
            const { number, intent } = req.body
            if (intent === 'remove') bot.blacklist.remove(number)
            if (intent === 'add') bot.blacklist.add(number)

            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ status: 'ok', number, intent }))
        })
    )

    adapterProvider.server.get(
        '/v1/blacklist/list',
        handleCtx(async (bot, req, res) => {
            const blacklist = bot.blacklist.getList()
            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ status: 'ok', blacklist }))
        })
    )

    httpServer(+PORT)
}

main()
