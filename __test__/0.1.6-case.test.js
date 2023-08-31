const { suite } = require('uvu')
const assert = require('uvu/assert')
const { addKeyword, createBot, createFlow, EVENTS } = require('../packages/bot/index')
const { setup, clear, delay } = require('../__mocks__/env')
const { generateRefprovider } = require('../packages/provider/common/hash')

const fakeHTTP = async (fakeData = []) => {
    await delay(50)
    const data = fakeData.map((u) => ({ body: `${u}` }))
    return Promise.resolve(data)
}

const suiteCase = suite('EVENTS:')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`WELCOME`, async ({ database, provider }) => {
    const flow = addKeyword(EVENTS.WELCOME).addAnswer('Bievenido')

    createBot({
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

    createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: generateRefprovider('_event_media_'),
    })
    await delay(100)
    const getHistory = database.listHistory.map((i) => i.answer)

    assert.is('media recibido', getHistory[0])
})

suiteCase(`LOCATION`, async ({ database, provider }) => {
    const flow = addKeyword(EVENTS.LOCATION).addAnswer('location recibido')

    createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: generateRefprovider('_event_location_'),
    })
    await delay(100)
    const getHistory = database.listHistory.map((i) => i.answer)

    assert.is('location recibido', getHistory[0])
})

suiteCase(`DOCUMENT`, async ({ database, provider }) => {
    const flow = addKeyword(EVENTS.DOCUMENT).addAnswer('document recibido')

    createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: generateRefprovider('_event_document_'),
    })
    await delay(100)
    const getHistory = database.listHistory.map((i) => i.answer)

    assert.is('document recibido', getHistory[0])
})

suiteCase(`VOICE_NOTE`, async ({ database, provider }) => {
    const flow = addKeyword(EVENTS.VOICE_NOTE).addAnswer('voice recibido')

    createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: generateRefprovider('_event_voice_note_'),
    })
    await delay(100)
    const getHistory = database.listHistory.map((i) => i.answer)

    assert.is('voice recibido', getHistory[0])
})

suiteCase.run()
