const { test } = require('uvu')
const assert = require('uvu/assert')

const { MOCK_MOBILE_WS } = require('../__mocks__/mobile.mock')
const { inout, database, botcore } = require('../packages/index')
const mockProvider = require('../packages/provider/adapters/mock')

const makeFlow = () => {
    const flowA = inout
        .addKeyword(['hola', 'ole'])
        .addAnswer('Bienvenido a github.com/leifermendez')
        .addAnswer('Soy Leifer y tu ?', {
            capture: true,
        })
        .addAnswer('Un gusto saludarte')
        .toJson()

    return [...flowA]
}

test(`[BotClass]: recibe los mensajes entrantes del provider`, async () => {
    let messagesIn = []
    let messagesOut = []

    const adapterFlow = inout.create(makeFlow())

    const adapterProvider = mockProvider
    const adapterDB = await database.create({
        engine: 'mock',
        credentials: {},
    })

    const bot = await botcore.create({
        flow: adapterFlow,
        database: adapterDB,
        provider: adapterProvider,
    })

    adapterProvider.on('message', (ctx) => messagesIn.push(ctx.message))

    adapterProvider.emit('message', { ...MOCK_MOBILE_WS, message: 'hola' })
    assert.is(messagesIn.join(), ['hola'].join())
    await delay(200)
    adapterProvider.emit('message', { ...MOCK_MOBILE_WS, message: 'Pedro!' })
    console.log(messagesIn)
    assert.is(messagesIn.join(), ['hola', 'Pedro!'].join())
    messagesOut = adapterDB.history
    // assert.is(messagesOut.join(), ['Pedro!'].join())
})

function delay(miliseconds) {
    return new Promise((res) => setTimeout(res, miliseconds))
}

test.run()
