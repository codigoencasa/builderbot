const { test } = require('uvu')
const assert = require('uvu/assert')

const { inout, provider, database, botcore } = require('../packages/index')

const adapterDB = database.create({
    engine: 'mock',
    credentials: {},
})

const adapterProvider = provider.create({
    vendor: 'mock',
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

test(`[Bot Vendedor]: recibe los mensajes entrantes del provider`, () => {
    const bot = botcore.create({
        flow: adapterFlow,
        database: adapterDB,
        provider: adapterProvider,
    })
})

test.run()
