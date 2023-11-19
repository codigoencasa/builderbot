const { suite } = require('uvu')
const assert = require('uvu/assert')
const { addKeyword, createBot, createFlow, EVENTS } = require('../packages/bot/index')
const { setup, clear, delay } = require('../__mocks__/env')

const testSuite = suite('Flujo: enviando eventos')

testSuite.before.each(setup)
testSuite.after.each(clear)

testSuite(`Responder a "EVENTS.LOCATION"`, async ({ database, provider }) => {
    const locationFlow = addKeyword(EVENTS.LOCATION).addAnswer('Gracias por tu location')

    await createBot({
        database,
        provider,
        flow: createFlow([locationFlow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: '_event_location__f405d946-cf07-uutt-l7e0-b6d475bc7f81',
    })

    await delay(200)
    const history = database.listHistory.map((item) => item.answer)
    assert.is('Gracias por tu location', history[0])
    assert.is(undefined, history[1])
})

testSuite(`Responder a "EVENTS.DOCUMENT"`, async ({ database, provider }) => {
    const documentFlow = addKeyword(EVENTS.DOCUMENT).addAnswer('Gracias por tu documento')

    createBot({
        database,
        provider,
        flow: createFlow([documentFlow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: '_event_document__f405d946-cf07-uutt-l7e0-b6d475bc7f81',
    })

    await delay(200)
    const history = database.listHistory.map((item) => item.answer)
    assert.is('Gracias por tu documento', history[0])
    assert.is(undefined, history[1])
})

testSuite(`Responder a "EVENTS.WELCOME"`, async ({ database, provider }) => {
    const welcomeFlow = addKeyword(EVENTS.WELCOME).addAnswer('Bienvenido!')

    await createBot({
        database,
        provider,
        flow: createFlow([welcomeFlow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: '_event_welcome__f405d946-cf07-uutt-l7e0-b6d475bc7f81',
    })

    await delay(200)
    const history = database.listHistory.map((item) => item.answer)
    assert.is('Bienvenido!', history[0])
    assert.is(undefined, history[1])
})

testSuite(`Responder a "EVENTS.MEDIA"`, async ({ database, provider }) => {
    const mediaFlow = addKeyword(EVENTS.MEDIA).addAnswer('gracias por la imagen o video!')

    await createBot({
        database,
        provider,
        flow: createFlow([mediaFlow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: '_event_media__f405d946-cf07-uutt-l7e0-b6d475bc7f81',
    })

    await delay(200)
    const history = database.listHistory.map((item) => item.answer)
    assert.is('gracias por la imagen o video!', history[0])
    assert.is(undefined, history[1])
})

testSuite(`Responder a "EVENTS.VOICE_NOTE"`, async ({ database, provider }) => {
    const voiceNoteFlow = addKeyword(EVENTS.VOICE_NOTE).addAnswer('gracias por la nota de voz!')

    await createBot({
        database,
        provider,
        flow: createFlow([voiceNoteFlow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: '_event_voice_note__f405d946-cf07-uutt-l7e0-b6d475bc7f81',
    })

    await delay(200)
    const history = database.listHistory.map((item) => item.answer)
    assert.is('gracias por la nota de voz!', history[0])
    assert.is(undefined, history[1])
})

testSuite.run()
