const { suite } = require('uvu')
const assert = require('uvu/assert')
const { addKeyword, createBot, createFlow, EVENTS } = require('../packages/bot/index')
const { setup, clear, delay } = require('../__mocks__/env')

const suiteCase = suite('Flujo: enviando eventos')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`Responder a "EVENTS.LOCATION"`, async ({ database, provider }) => {
    const flow = addKeyword(EVENTS.LOCATION).addAnswer('Gracias por tu location')

    createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: '_event_location__f405d946-cf07-uutt-l7e0-b6d475bc7f81',
    })

    await delay(200)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is('Gracias por tu location', getHistory[0])
    assert.is(undefined, getHistory[1])
})

suiteCase(`Responder a "EVENTS.DOCUMENT"`, async ({ database, provider }) => {
    const flow = addKeyword(EVENTS.DOCUMENT).addAnswer('Gracias por tu documento')

    createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: '_event_document__f405d946-cf07-uutt-l7e0-b6d475bc7f81',
    })

    await delay(200)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is('Gracias por tu documento', getHistory[0])
    assert.is(undefined, getHistory[1])
})

suiteCase(`Responder a "EVENTS.WELCOME"`, async ({ database, provider }) => {
    const flow = addKeyword(EVENTS.WELCOME).addAnswer('Bienvenido!')

    createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: '_event_welcome__f405d946-cf07-uutt-l7e0-b6d475bc7f81',
    })

    await delay(200)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is('Bienvenido!', getHistory[0])
    assert.is(undefined, getHistory[1])
})

suiteCase(`Responder a "EVENTS.MEDIA"`, async ({ database, provider }) => {
    const flow = addKeyword(EVENTS.MEDIA).addAnswer('gracias por la imagen o video!')

    createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: '_event_media__f405d946-cf07-uutt-l7e0-b6d475bc7f81',
    })

    await delay(200)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is('gracias por la imagen o video!', getHistory[0])
    assert.is(undefined, getHistory[1])
})

suiteCase(`Responder a "EVENTS.VOICE_NOTE"`, async ({ database, provider }) => {
    const flow = addKeyword(EVENTS.VOICE_NOTE).addAnswer('gracias por la nota de voz!')

    createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: '_event_voice_note__f405d946-cf07-uutt-l7e0-b6d475bc7f81',
    })

    await delay(200)
    const getHistory = database.listHistory.map((i) => i.answer)
    assert.is('gracias por la nota de voz!', getHistory[0])
    assert.is(undefined, getHistory[1])
})

suiteCase.run()
