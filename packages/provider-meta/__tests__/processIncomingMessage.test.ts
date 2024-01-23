import proxyquire from 'proxyquire'
import { stub } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { Message } from '../src/types'

const mockedProvider = 'mocked-ref-provider'
const utilsMock = {
    generateRefprovider: stub().returns(mockedProvider),
}

test.before.each(() => {
    utilsMock.generateRefprovider.resetHistory()
})

const getMediaUrlStub = stub().resolves('mocked-image-url')

const { processIncomingMessage } = proxyquire('../src/utils', {
    getMediaUrl: { getMediaUrl: getMediaUrlStub() },
    '@bot-whatsapp/bot': { utils: utilsMock },
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

test('processIncomingMessage for text tipo button', async () => {
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

test('processIncomingMessage para mensaje de tipo image', async () => {
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

test.run()
