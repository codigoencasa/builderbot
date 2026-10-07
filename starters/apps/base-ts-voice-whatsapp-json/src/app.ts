import { createBot, createProvider, createFlow, addKeyword, utils } from '@builderbot/bot'
import { JsonFileDB as Database } from '@builderbot/database-json'
import { MetaProvider as Provider } from '@builderbot/provider-meta'

const docFlow = addKeyword<Provider, Database>(['doc', 'documentation']).addAnswer(
    'You can read the documentation at https://builderbot.app/docs'
)

const agentFlow = addKeyword<Provider, Database>(['agent', 'human', 'person']).addAnswer(
    'Understood, a human agent will contact you shortly.'
)

const welcomeFlow = addKeyword<Provider, Database>(['hi', 'hello', 'hola'])
    .addAnswer('Hello! You are talking to a voice bot.')
    .addAnswer(
        'Tell me what you need. Say *doc* for the documentation or *agent* to talk to a person.',
        { capture: true },
        async (ctx, { fallBack }) => {
            const body = ctx.body.toLowerCase()
            if (!body.includes('doc') && !body.includes('agent')) {
                return fallBack('Sorry, I did not catch that. Say *doc* or *agent*.')
            }
            return
        },
        [docFlow, agentFlow]
    )

const registerFlow = addKeyword<Provider, Database>(utils.setEvent('REGISTER_FLOW'))
    .addAnswer('What is your name?', { capture: true }, async (ctx, { state }) => {
        await state.update({ name: ctx.body })
    })
    .addAnswer('Thanks! How old are you?', { capture: true }, async (ctx, { state }) => {
        await state.update({ age: ctx.body })
    })
    .addAction(async (_, { flowDynamic, state }) => {
        await flowDynamic(`${state.get('name')}, thanks for your information. Your age: ${state.get('age')}`)
    })


const main = async () => {
    const adapterFlow = createFlow([welcomeFlow, docFlow, agentFlow, registerFlow])
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
