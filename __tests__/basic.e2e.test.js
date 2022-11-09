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

    bot.on('message', (ctx) => messages.push(ctx))
    bot.emit('message', 'hola')
    bot.emit('message', 'otro')

    const getHistoryFromDB = adapterDB.engineDB.listHistory

    assert.is(messages.join(), ['hola', 'otro'].join())
    assert.is(
        getHistoryFromDB.join(),
        [
            'hola',
            'Bienvenido a tu tienda 🥲',
            'escribe *catalogo* o *ofertas*',
            'otro',
        ].join()
    )
})

test.run()
