const { test } = require('uvu')
const assert = require('uvu/assert')
const MOCK_DB = require('../packages/database/src/mock')
const PROVIDER_DB = require('../packages/provider/src/mock')
const { addKeyword, createBot, createFlow, createProvider } = require('../packages/bot/index')

test(`[Caso - 08] Regular expression on keyword`, async () => {
    const provider = createProvider(PROVIDER_DB)
    const database = new MOCK_DB()

    const REGEX_CREDIT_NUMBER = `/(^4[0-9]{12}(?:[0-9]{3})?$)|(^(?:5[1-5][0-9]{2}|222[1-9]|22[3-9][0-9]|2[3-6][0-9]{2}|27[01][0-9]|2720)[0-9]{12}$)|(3[47][0-9]{13})|(^3(?:0[0-5]|[68][0-9])[0-9]{11}$)|(^6(?:011|5[0-9]{2})[0-9]{12}$)|(^(?:2131|1800|35\d{3})\d{11}$)/gm`
    const flujoPrincipal = addKeyword(REGEX_CREDIT_NUMBER, { regex: true })
        .addAnswer(`Gracias por proporcionar un numero de tarjeta valido`)
        .addAnswer('Fin!')

    createBot({
        database,
        flow: createFlow([flujoPrincipal]),
        provider,
    })

    provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    provider.delaySendMessage(20, 'message', {
        from: '000',
        body: '374245455400126',
    })

    await delay(40)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is('Gracias por proporcionar un numero de tarjeta valido', getHistory[0])
    assert.is('Fin!', getHistory[1])
    assert.is(undefined, getHistory[2])
})

test.run()

function delay(ms) {
    return new Promise((res) => setTimeout(res, ms))
}
