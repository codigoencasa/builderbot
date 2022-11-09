const { test } = require('uvu')
const assert = require('uvu/assert')

// const { inout, provider, database, botcore } = require('../lib/index.cjs')
const { inout, provider, database, botcore } = require('../packages/index')

const adapterDB = database.create({
    engine: 'json', // 'mysql / pg / mongo / json (json-default)',
    credentials: {},
})

const adapterProvider = provider.create({
    vendor: 'web', //'twilio / web / meta',
    credentials: {},
})

const makeFlow = () => {
    const flowA = inout
        .addKeyword('hola')
        .addAnswer('Bienvenido a tu tienda 🥲')
        .addAnswer('escribe *catalogo* o *ofertas*')
        .toJson()

    return [...flowA]
}

const adapterFlow = inout.create(makeFlow())

test(`[BotClass]: recibe los mensajes entrantes del provider`, () => {
    let messages = []

    const bot = botcore.create({
        flow: adapterFlow,
        database: adapterDB,
        provider: adapterProvider,
    })

    bot.on('message', (ctx) => messages.push(ctx.body))
    bot.emit('message', { body: 'hola' })
    bot.emit('message', { body: 'otro' })

    assert.is(messages.join(','), ['hola', 'otro'].join(','))
})

test.run()
