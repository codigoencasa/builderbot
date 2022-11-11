const { test } = require('uvu')
const assert = require('uvu/assert')

const { inout, database, botcore } = require('../packages/index')
const MockProvider = require('../packages/provider/adapters/mock')
const MockDB = require('../packages/database/adapters/mock')

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

    const adapterProvider = new MockProvider()
    const adapterDB = await database.create(new MockDB())

    await botcore.create({
        flow: adapterFlow,
        database: adapterDB,
        provider: adapterProvider,
    })

    await delay(1000)
    messagesOut = adapterDB.history
    assert.is(messagesOut.join(), ['hola'].join())
})

function delay(miliseconds) {
    return new Promise((res) => setTimeout(res, miliseconds))
}

test.run()
