const { test } = require('uvu')
const assert = require('uvu/assert')
/**
 *  require('@bot-whatsapp')
 */
const { inout, provider, bot } = require('../lib/index.cjs')

/**
 * MockDB
 */
class DatabaseClass {
    constructor() {}

    saveLog = (ctx) => {
        return ctx
    }
}

const adapterDB = new DatabaseClass()

const adapterFlow = new inout.instance(
    (() => {
        const flowA = inout
            .addKeyword('hola')
            .addAnswer('Bienvenido a tu tienda 🥲')
            .addAnswer('escribe *catalogo* o *ofertas*')
            .toJson()

        const flowB = inout
            .addKeyword(['catalogo', 'ofertas'])
            .addAnswer('Este es nuestro CATALOGO mas reciente!', {
                buttons: [{ body: 'Xiaomi' }, { body: 'Samsung' }],
            })
            .toJson()

        const flowC = inout
            .addKeyword('Xiaomi')
            .addAnswer('Estos son nuestro productos XIAOMI ....', {
                media: 'https://....',
            })
            .addAnswer('Si quieres mas info escrbie *info*')
            .toJson()

        const flowD = inout
            .addKeyword('chao!')
            .addAnswer('bye!')
            .addAnswer('Recuerda que tengo esta promo', {
                media: 'https://media2.giphy.com/media/VQJu0IeULuAmCwf5SL/giphy.gif',
            })
            .toJson()

        const flowE = inout
            .addKeyword('Modelo C', { sensitive: false })
            .addAnswer('100USD', { media: 'http//:...' })
            .toJson()

        return [...flowA, ...flowB, ...flowC, ...flowC, ...flowD, ...flowE]
    })()
)

const adapterProvider = new provider.instance()

test(`[Flow Basico]: BotClass`, () => {
    let messages = []

    const flows = adapterFlow
    const databases = adapterDB
    const providers = adapterProvider

    const botBasic = new bot.instance(flows, databases, providers)

    botBasic.on('message', (ctx) => messages.push(ctx.body))
    botBasic.emit('message', { body: 'hola' })
    botBasic.emit('message', { body: 'otro' })

    assert.is(messages.join(','), ['hola', 'otro'].join(','))
})

test.run()
