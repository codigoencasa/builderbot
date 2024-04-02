import proxyquire from 'proxyquire'
import { stub } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import type { Message } from '../src/types'

const mockedProvider = 'mocked-ref-provider'
const utilsMock = {
    generateRefProvider: stub().returns(mockedProvider),
}

test.before.each(() => {
    utilsMock.generateRefProvider.resetHistory()
})

const getMediaUrlStub = stub().resolves('mocked-image-url')

const { processIncomingMessage } = proxyquire('../src/utils', {
    getMediaUrl: { getMediaUrl: getMediaUrlStub() },
    '@builderbot/bot': { utils: utilsMock },
})

test('processIncomingMessage - for text message', async () => {
    const params = {
        pushName: 'John Doe',
        message: {
            type: 'text',
            from: 'sender-id',
            text: { body: 'Hola, mundo!' },
        },
        to: 'recipient-id',
        jwtToken: 'jwt-token',
        version: '1.0',
        numberId: '12345',
    }

    const result = await processIncomingMessage(params)
    assert.equal(result.type, 'text')
    assert.equal(result.from, 'sender-id')
    assert.equal(result.to, 'recipient-id')
    assert.equal(result.body, 'Hola, mundo!')
    assert.equal(result.pushName, 'John Doe')
})

test('processIncomingMessage for text interactive', async () => {
    const params = {
        pushName: 'John Doe',
        message: {
            type: 'interactive',
            from: 'sender-id',
            interactive: {
                button_reply: { title: 'Button Title' },
                list_reply: { id: 'List ID', title: 'List Title' },
            },
        },
        to: 'recipient-id',
        jwtToken: 'jwt-token',
        version: '1.0',
        numberId: '12345',
    }

    const result = await processIncomingMessage(params)
    assert.equal(result.type, 'interactive')
    assert.equal(result.from, 'sender-id')
    assert.equal(result.to, 'recipient-id')
    assert.equal(result.pushName, 'John Doe')
    assert.equal(result.body, 'Button Title')
    assert.equal(result.title_button_reply, 'Button Title')
    assert.equal(result.title_list_reply, 'List Title')
})

test('processIncomingMessage for type  button', async () => {
    const params = {
        pushName: 'John Doe',
        message: {
            type: 'button',
            from: 'sender-id',
            button: {
                text: 'Click me!',
                payload: 'button-payload',
            },
        },
        to: 'recipient-id',
        jwtToken: 'jwt-token',
        version: '1.0',
        numberId: '12345',
    }

    const result = await processIncomingMessage(params)
    assert.equal(result.type, 'button')
    assert.equal(result.from, 'sender-id')
    assert.equal(result.to, 'recipient-id')
    assert.equal(result.pushName, 'John Doe')
    assert.equal(result.body, 'Click me!')
    assert.equal(result.payload, 'button-payload')
    assert.equal(result.title_button_reply, 'button-payload')
})

test('processIncomingMessage for type  image', async () => {
    const params = {
        pushName: 'John Doe',
        message: {
            type: 'image',
            from: 'sender-id',
            image: {
                id: 'image-id',
            },
        },
        to: 'recipient-id',
        jwtToken: 'jwt-token',
        version: '1.0',
        numberId: '12345',
    }
    getMediaUrlStub()
    const result: Message = await processIncomingMessage(params)
    assert.equal(result.type, 'image')
    assert.equal(result.from, 'sender-id')
    assert.equal(result.to, 'recipient-id')
    assert.equal(result.pushName, 'John Doe')
    assert.ok(result.body.includes('_event_media__'))
})

test('processIncomingMessage for type  document', async () => {
    const params = {
        pushName: 'John Doe',
        message: {
            type: 'document',
            document: { id: '12344' },
            from: 'sender-id',
        },
        to: 'recipient-id',
        jwtToken: 'jwt-token',
        version: '1.0',
        numberId: '12345',
    }
    getMediaUrlStub()
    const result: Message = await processIncomingMessage(params)
    assert.equal(result.type, 'document')
    assert.equal(result.from, 'sender-id')
    assert.equal(result.to, 'recipient-id')
    assert.equal(result.pushName, 'John Doe')
    assert.ok(result.body.includes('_event_document_'))
})

test('processIncomingMessage for type  video', async () => {
    const params = {
        pushName: 'John Doe',
        message: {
            type: 'video',
            video: { id: '12344' },
            from: 'sender-id',
        },
        to: 'recipient-id',
        jwtToken: 'jwt-token',
        version: '1.0',
        numberId: '12345',
    }
    const result: Message = await processIncomingMessage(params)
    assert.equal(result.type, 'video')
    assert.equal(result.from, 'sender-id')
    assert.equal(result.to, 'recipient-id')
    assert.equal(result.pushName, 'John Doe')
    assert.ok(result.body.includes('_event_media_'))
})

test('processIncomingMessage for type  location', async () => {
    const params = {
        pushName: 'John Doe',
        message: {
            type: 'location',
            from: 'sender-id',
            location: {
                latitude: 2733,
                longitude: 2733,
            },
        },
        to: 'recipient-id',
        jwtToken: 'jwt-token',
        version: '1.0',
        numberId: '12345',
    }
    const result: Message = await processIncomingMessage(params)
    assert.equal(result.type, 'location')
    assert.equal(result.from, 'sender-id')
    assert.equal(result.to, 'recipient-id')
    assert.equal(result.pushName, 'John Doe')
    assert.ok(result.body.includes('_event_location_'))
})

test('processIncomingMessage for type  audio', async () => {
    const params = {
        pushName: 'John Doe',
        message: {
            type: 'audio',
            from: 'sender-id',
            audio: { id: '12344' },
        },
        to: 'recipient-id',
        jwtToken: 'jwt-token',
        version: '1.0',
        numberId: '12345',
    }
    const result: Message = await processIncomingMessage(params)
    assert.equal(result.type, 'audio')
    assert.equal(result.from, 'sender-id')
    assert.equal(result.to, 'recipient-id')
    assert.equal(result.pushName, 'John Doe')
    assert.ok(result.body.includes('_event_audio_'))
})

test('processIncomingMessage for type  sticker', async () => {
    const params = {
        pushName: 'John Doe',
        message: {
            type: 'sticker',
            from: 'sender-id',
            sticker: { id: '12344' },
        },
        to: 'recipient-id',
        jwtToken: 'jwt-token',
        version: '1.0',
        numberId: '12345',
    }
    const result: Message = await processIncomingMessage(params)
    assert.equal(result.type, 'sticker')
    assert.equal(result.from, 'sender-id')
    assert.equal(result.to, 'recipient-id')
    assert.equal(result.pushName, 'John Doe')
    assert.ok(result.body.includes('_event_media_'))
})

test('processIncomingMessage for type  contacts', async () => {
    const params = {
        pushName: 'John Doe',
        message: {
            type: 'contacts',
            from: 'sender-id',
            contacts: [
                {
                    name: 'Test',
                    phones: '122355',
                },
            ],
        },
        to: 'recipient-id',
        jwtToken: 'jwt-token',
        version: '1.0',
        numberId: '12345',
    }
    const result: Message = await processIncomingMessage(params)
    assert.equal(result.type, 'contacts')
    assert.equal(result.from, 'sender-id')
    assert.equal(result.to, 'recipient-id')
    assert.equal(result.pushName, 'John Doe')
    assert.ok(result.body.includes('_event_contacts_'))
})

test('processIncomingMessage for type  order', async () => {
    const params = {
        pushName: 'John Doe',
        message: {
            type: 'order',
            from: 'sender-id',
            order: {
                catalog_id: '3636336',
                product_items: '9994',
            },
        },
        to: 'recipient-id',
        jwtToken: 'jwt-token',
        version: '1.0',
        numberId: '12345',
    }
    const result: Message = await processIncomingMessage(params)
    assert.equal(result.type, 'order')
    assert.equal(result.from, 'sender-id')
    assert.equal(result.to, 'recipient-id')
    assert.equal(result.pushName, 'John Doe')
    assert.ok(result.body.includes('_event_order_'))
})

test.skip('processIncomingMessage break', async () => {
    const params = {
        pushName: 'John Doe',
        message: {
            type: 'test',
            from: 'sender-id',
            order: {
                catalog_id: '3636336',
                product_items: '9994',
            },
        },
        to: 'recipient-id',
        jwtToken: 'jwt-token',
        version: '1.0',
        numberId: '12345',
    }
    const result: Message = await processIncomingMessage(params)
    assert.equal(result, undefined)
})
test.skip('processIncomingMessage break', async () => {
    const params = {
        pushName: 'John Doe',
        message: {
            type: 'test',
            from: 'sender-id',
            order: {
                catalog_id: '3636336',
                product_items: '9994',
            },
        },
        to: 'recipient-id',
        jwtToken: 'jwt-token',
        version: '1.0',
        numberId: '12345',
    }
    const result: Message = await processIncomingMessage(params)
    assert.equal(result.message_id, undefined)
    assert.equal(result.timestamp, undefined)
})

test.run()
