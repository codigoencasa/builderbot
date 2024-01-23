import axios from 'axios'
import { stub } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { MetaProvider } from '../src/metaProvider'

const httpsMock = {
    post: stub(axios, 'post'),
}

const metaProvider = new MetaProvider({
    jwtToken: 'your_jwt_token',
    numberId: 'your_number_id',
    verifyToken: 'your_verify_token',
    version: 'v16.0',
})

const mockMessageBody = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: 'recipient_id',
    type: 'text',
    text: {
        preview_url: false,
        body: 'Hello, World!',
    },
}

const sendMessageMetaStub = stub(metaProvider, 'sendMessageMeta')

test('sendMessageToApi - should send a message to API', async () => {
    const mockResponseData = {}
    httpsMock.post.resolves({ data: mockResponseData })
    const response = await metaProvider.sendMessageToApi(mockMessageBody)
    assert.equal(response, mockResponseData)
})

test('busEvents - should return an array with correct events and functions', () => {
    const events = metaProvider.busEvents()
    assert.equal(events.length, 3)
    assert.equal(events[0].event, 'auth_failure')
    assert.type(events[0].func, 'function')
    assert.equal(events[1].event, 'ready')
    assert.type(events[1].func, 'function')
    assert.equal(events[2].event, 'message')
    assert.type(events[2].func, 'function')
})

test('sendtext - should correctly call sendMessageMeta with the message body', async () => {
    const to = '1234546'
    const message = 'Hola, esto es un mensaje de prueba'
    const expectedBody = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: {
            preview_url: false,
            body: message,
        },
    }
    await metaProvider.sendtext(to, message)
    assert.ok(sendMessageMetaStub.calledWith(expectedBody))
    sendMessageMetaStub.restore()
})

test('sendImage - should correctly call sendMessageMeta with the message body', async () => {
    const to = '12345'
    const mediaInput = 'ruta/a/imagen.jpg'
    const expectedMediaId = null
    const expectedBody = {
        messaging_product: 'whatsapp',
        to: '12345',
        type: 'image',
        image: { id: 'idDeLaImagen' },
    }
    httpsMock.post.resolves({ data: { id: expectedMediaId } })
    sendMessageMetaStub.returns()
    await metaProvider.sendImage(to, mediaInput)
    assert.equal(httpsMock.post.called, true)
    assert.equal(sendMessageMetaStub.called, true)
    console.log(sendMessageMetaStub.calledWith(expectedBody))
})

test('sendVideo - should correctly call sendMessageMeta with the message body', async () => {
    const to = '12345'
    const mediaInput = 'ruta/a/imagen.jpg'
    const expectedMediaId = null
    const expectedBody = {
        messaging_product: 'whatsapp',
        to: '12345',
        type: 'video',
        image: { id: 'idDeLaImagen' },
    }
    httpsMock.post.resolves({ data: { id: expectedMediaId } })
    sendMessageMetaStub.returns()
    await metaProvider.sendVideo(to, mediaInput)
    assert.equal(httpsMock.post.called, true)
    assert.equal(sendMessageMetaStub.called, true)
    console.log(sendMessageMetaStub.calledWith(expectedBody))
})

test.run()
