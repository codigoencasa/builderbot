import { suite } from 'uvu'
import * as assert from 'uvu/assert'

import { setup, clear } from '../../__mock__/env'
import { addKeyword, createBot, createFlow, EVENTS } from '../../src'
import { delay, generateRefProvider } from '../../src/utils'

const suiteCase = suite('EVENTS:')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`WELCOME`, async ({ database, provider }) => {
    const flow = addKeyword(EVENTS.WELCOME).addAnswer('Bievenido')

    await createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await delay(100)
    const getHistory = database.listHistory.map((i) => i.answer)

    assert.is('Bievenido', getHistory[0])
})

suiteCase(`MEDIA`, async ({ database, provider }) => {
    const flow = addKeyword(EVENTS.MEDIA).addAnswer('media recibido')

    await createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: generateRefProvider('_event_media_'),
    })
    await delay(100)
    const getHistory = database.listHistory.map((i) => i.answer)

    assert.is('media recibido', getHistory[0])
})

suiteCase(`LOCATION`, async ({ database, provider }) => {
    const flow = addKeyword(EVENTS.LOCATION).addAnswer('location recibido')

    await createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: generateRefProvider('_event_location_'),
    })
    await delay(100)
    const getHistory = database.listHistory.map((i) => i.answer)

    assert.is('location recibido', getHistory[0])
})

suiteCase(`DOCUMENT`, async ({ database, provider }) => {
    const flow = addKeyword(EVENTS.DOCUMENT).addAnswer('document recibido')

    await createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: generateRefProvider('_event_document_'),
    })
    await delay(100)
    const getHistory = database.listHistory.map((i) => i.answer)

    assert.is('document recibido', getHistory[0])
})

suiteCase(`VOICE_NOTE`, async ({ database, provider }) => {
    const flow = addKeyword(EVENTS.VOICE_NOTE).addAnswer('voice recibido')

    await createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: generateRefProvider('_event_voice_note_'),
    })
    await delay(100)
    const getHistory = database.listHistory.map((i) => i.answer)

    assert.is('voice recibido', getHistory[0])
})

suiteCase.run()
