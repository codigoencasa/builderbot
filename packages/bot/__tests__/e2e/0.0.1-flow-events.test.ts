import { suite } from 'uvu'
import * as assert from 'uvu/assert'

import { clear, delay, setup } from '../../__mock__/env'
import { EVENTS, addKeyword, createBot, createFlow } from '../../src'
import { generateRefProvider } from '../../src/utils'

const testSuite = suite('Flujo: enviando eventos')

testSuite.before.each(setup)
testSuite.after.each(clear)

testSuite(`Responder a "EVENTS.LOCATION"`, async (context) => {
    const { database, provider } = context
    const locationFlow = addKeyword(EVENTS.LOCATION).addAnswer('Gracias por tu location')

    await createBot({
        database,
        provider,
        flow: createFlow([locationFlow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: generateRefProvider('_event_location_'),
    })

    await delay(200)
    const history = database.listHistory.map((item) => item.answer)
    assert.is(history[0], 'Gracias por tu location')
    assert.is(history[1], undefined)
})

testSuite(`Responder a "EVENTS.DOCUMENT"`, async (context) => {
    const { database, provider } = context
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
    assert.is(history[0], 'Gracias por tu documento')
    assert.is(history[1], undefined)
})

testSuite(`Responder a "EVENTS.WELCOME"`, async (context) => {
    const { database, provider } = context
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
    assert.is(history[0], 'Bienvenido!')
    assert.is(history[1], undefined)
})

testSuite(`Responder a "EVENTS.MEDIA"`, async (context) => {
    const { database, provider } = context
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
    assert.is(history[0], 'gracias por la imagen o video!')
    assert.is(history[1], undefined)
})

testSuite(`Responder a "EVENTS.VOICE_NOTE"`, async (context) => {
    const { database, provider } = context
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
    assert.is(history[0], 'gracias por la nota de voz!')
    assert.is(history[1], undefined)
})

testSuite.run()
