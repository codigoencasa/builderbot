const { suite } = require('uvu')
const assert = require('uvu/assert')
const { addKeyword, createBot, createFlow } = require('../packages/bot/index')
const { setup, clear, delay } = require('../__mocks__/env')

const suiteCase = suite('Flujo: addAction (capture) encadenados')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`Encadenanos addAction con captures`, async ({ database, provider }) => {
    const flujoPrincipal = addKeyword(['hola'])
        .addAction(async (ctx, { flowDynamic }) => {
            await flowDynamic(`Hola! primer flow dynamic. respondeme algo`)
        })
        .addAction({ capture: true }, async (ctx, { flowDynamic, state }) => {
            const reply = ctx.body
            await state.update({ reply })
            await flowDynamic(`Esto me respondieste ${reply}`)
        })
        .addAction(async (ctx, { flowDynamic }) => {
            await flowDynamic(`Hola! segundo flow dynamic. respondeme algo`)
        })
        .addAction({ capture: true }, async (ctx, { flowDynamic, state }) => {
            const currentState = state.getMyState()?.reply
            const reply = ctx.body
            await state.update({ reply: currentState + ' ' + reply })
            await flowDynamic(`Esto me respondieste ${reply}`)
        })
        .addAnswer('Chao')

    await createBot({
        database,
        flow: createFlow([flujoPrincipal]),
        provider,
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await provider.delaySendMessage(10, 'message', {
        from: '000',
        body: 'ping',
    })

    await delay(2000)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is('__call_action__', getHistory[0])
    assert.is('Hola! primer flow dynamic. respondeme algo', getHistory[1])
    assert.is('__capture_only_intended__', getHistory[2])
    assert.is('ping', getHistory[3])
    assert.is('Esto me respondieste ping', getHistory[4])
    assert.is('__call_action__', getHistory[5])
    assert.is('Hola! segundo flow dynamic. respondeme algo', getHistory[6])
    assert.is('__capture_only_intended__', getHistory[7])
    assert.is(undefined, getHistory[8])
})

suiteCase.run()
