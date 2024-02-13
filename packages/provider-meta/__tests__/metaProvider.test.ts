import axios from 'axios'
import { stub } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { MetaProvider } from '../src/metaProvider'
import { Localization } from '../src/types'

const httpsMock = {
    post: stub(axios, 'post'),
}

const metaProvider = new MetaProvider({
    jwtToken: 'your_jwt_token',
    numberId: 'your_number_id',
    verifyToken: 'your_verify_token',
    version: 'v16.0',
    port: 3999,
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
const sendMediaStub = stub(metaProvider, 'sendMedia')

test('sendMessageToApi - should send a message to API', async () => {
    const mockResponseData = {}
    httpsMock.post.resolves({ data: mockResponseData })
    const response = await metaProvider.sendMessageToApi(mockMessageBody)
    assert.equal(response, mockResponseData)
})
test('sendMessageToApi - should send a message to API', async () => {
    try {
        httpsMock.post.rejects(new Error('Error!'))
        await metaProvider.sendMessageToApi(mockMessageBody)
    } catch (error) {
        assert.equal(error.message, 'Error!')
    }
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
    httpsMock.post.resolves({ data: { id: expectedMediaId } })
    sendMessageMetaStub.returns()
    await metaProvider.sendImage(to, mediaInput)
    assert.equal(httpsMock.post.called, true)
    assert.equal(sendMessageMetaStub.called, true)
})

test('sendVideo - should correctly call sendMessageMeta with the message body', async () => {
    const to = '12345'
    const mediaInput = 'ruta/a/imagen.jpg'
    const expectedMediaId = null
    httpsMock.post.resolves({ data: { id: expectedMediaId } })
    sendMessageMetaStub.returns()
    await metaProvider.sendVideo(to, mediaInput)
    assert.equal(httpsMock.post.called, true)
    assert.equal(sendMessageMetaStub.called, true)
})

test('sendLists should call sendMessageMeta with the correct parameters', async () => {
    const sendMessageMetaStub = stub(metaProvider, 'sendMessageMeta').resolves({})
    const to = '+123456789'
    const list = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: 'recipient_id',
    }
    const expectedBody = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: { ...list, type: 'list' },
    }
    await metaProvider.sendLists(to, list)
    assert.equal(sendMessageMetaStub.calledOnce, true)
    assert.equal(JSON.stringify(sendMessageMetaStub.firstCall.args[0]), JSON.stringify(expectedBody))
    assert.ok(sendMessageMetaStub.calledWith(expectedBody))
    sendMessageMetaStub.restore()
})

test('sendList should call sendMessageMeta with the correct parameters', async () => {
    const sendMessageMetaStub = stub(metaProvider, 'sendMessageMeta').resolves({})
    const to = '+123456789'
    const header = 'List Header'
    const text = 'List Text'
    const footer = 'List Footer'
    const button = 'List Button'
    const list = [
        {
            title: 'test',
            rows: [
                {
                    id: 1,
                    title: 'test',
                    description: 'Description!',
                },
            ],
        },
    ]

    await metaProvider.sendList(to, header, text, footer, button, list)
    assert.equal(sendMessageMetaStub.calledOnce, true)

    const parseList = list.map((listItem) => ({
        title: listItem.title,
        rows: listItem.rows.map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description,
        })),
    }))

    const expectedBody = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
            type: 'list',
            header: {
                type: 'text',
                text: header,
            },
            body: {
                text: text,
            },
            footer: {
                text: footer,
            },
            action: {
                button: button,
                sections: parseList,
            },
        },
    }

    assert.equal(JSON.stringify(sendMessageMetaStub.firstCall.args[0]), JSON.stringify(expectedBody))
    assert.ok(sendMessageMetaStub.calledWith(expectedBody))
    sendMessageMetaStub.restore()
})

test('sendButtons should call sendMessageMeta with the correct parameters', async () => {
    const sendMessageMetaStub = stub(metaProvider, 'sendMessageMeta').resolves({})
    const to = '+123456789'
    const text = 'Button Text'
    const buttons = [{ body: 'Button 1' }, { body: 'Button 2' }, { body: 'Button 3' }]
    await metaProvider.sendButtons(to, text, buttons)
    assert.equal(sendMessageMetaStub.calledOnce, true)

    const parseButtons = buttons.map((btn, i) => ({
        type: 'reply',
        reply: {
            id: `btn-${i}`,
            title: btn.body,
        },
    }))

    const expectedBody = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
            type: 'button',
            body: {
                text: text,
            },
            action: {
                buttons: parseButtons,
            },
        },
    }

    assert.equal(JSON.stringify(sendMessageMetaStub.firstCall.args[0]), JSON.stringify(expectedBody))
    assert.ok(sendMessageMetaStub.calledWith(expectedBody))
    sendMessageMetaStub.restore()
})

test('sendButtonsText should call sendMessageMeta with the correct parameters', async () => {
    const sendMessageMetaStub = stub(metaProvider, 'sendMessageMeta').resolves({})
    const to = '+123456789'
    const text = 'Button Text'
    const buttons = [
        { id: 'btn1', title: 'Button 1' },
        { id: 'btn2', title: 'Button 2' },
        { id: 'btn3', title: 'Button 3' },
    ]

    await metaProvider.sendButtonsText(to, text, buttons)
    assert.equal(sendMessageMetaStub.calledOnce, true)

    const parseButtons = buttons.map((btn) => ({
        type: 'reply',
        reply: {
            id: btn.id,
            title: btn.title,
        },
    }))

    const expectedBody = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
            type: 'button',
            body: {
                text: text,
            },
            action: {
                buttons: parseButtons,
            },
        },
    }

    assert.equal(JSON.stringify(sendMessageMetaStub.firstCall.args[0]), JSON.stringify(expectedBody))
    assert.ok(sendMessageMetaStub.calledWith(expectedBody))
    sendMessageMetaStub.restore()
})

test('sendButtonsMedia should call sendMessageMeta with the correct parameters', async () => {
    const sendMessageMetaStub = stub(metaProvider, 'sendMessageMeta').resolves({})

    // Mock data for the test
    const to = '+123456789'
    const text = 'Button Text'
    const buttons = [
        { id: 'btn1', title: 'Button 1' },
        { id: 'btn2', title: 'Button 2' },
        { id: 'btn3', title: 'Button 3' },
    ]
    const url = 'https://example.com/image.jpg'
    await metaProvider.sendButtonsMedia(to, text, buttons, url)
    assert.equal(sendMessageMetaStub.calledOnce, true)

    const parseButtons = buttons.map((btn) => ({
        type: 'reply',
        reply: {
            id: btn.id,
            title: btn.title,
        },
    }))

    const expectedBody = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
            type: 'button',
            header: {
                type: 'image',
                image: {
                    link: url,
                },
            },
            body: {
                text: text,
            },
            action: {
                buttons: parseButtons,
            },
        },
    }

    assert.equal(JSON.stringify(sendMessageMetaStub.firstCall.args[0]), JSON.stringify(expectedBody))
    assert.ok(sendMessageMetaStub.calledWith(expectedBody))

    sendMessageMetaStub.restore()
})

test('sendTemplate should call sendMessageMeta with the correct parameters', async () => {
    const sendMessageMetaStub = stub(metaProvider, 'sendMessageMeta').resolves({})
    const to = '+123456789'
    const template = 'example_template'
    const languageCode = 'en_US'
    await metaProvider.sendTemplate(to, template, languageCode)
    assert.equal(sendMessageMetaStub.calledOnce, true)
    const expectedBody: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
            name: template,
            language: {
                code: languageCode,
            },
            components: [
                {
                    type: 'header',
                    parameters: [
                        {
                            type: 'image',
                            image: {
                                link: 'https://i.imgur.com/3xUQq0U.png',
                            },
                        },
                    ],
                },
                {
                    type: 'body',
                    parameters: [
                        {
                            type: 'text',
                            text: 'text-string',
                        },
                        {
                            type: 'currency',
                            currency: {
                                fallback_value: '$100.99',
                                code: 'USD',
                                amount_1000: 100990,
                            },
                        },
                    ],
                },
                {
                    type: 'button',
                    subtype: 'quick_reply',
                    index: 0,
                    parameters: [
                        {
                            type: 'payload',
                            payload: 'aGlzIHRoaXMgaXMgY29v',
                        },
                    ],
                },
            ],
        },
    }

    assert.equal(JSON.stringify(sendMessageMetaStub.firstCall.args[0]), JSON.stringify(expectedBody))
    assert.ok(sendMessageMetaStub.calledWith(expectedBody))

    sendMessageMetaStub.restore()
})

test('sendContacts should call sendMessageMeta with the correct parameters', async () => {
    const sendMessageMetaStub = stub(metaProvider, 'sendMessageMeta').resolves({})
    const to = '+123456789'
    const contacts = [
        {
            first_name: 'John Doe',
            last_name: 'John Doe',
            middle_name: 'John Doe',
            suffix: 'John Doe',
            prefix: 'John Doe',
            name: 'John Doe',
            birthday: 'John Doe',
            company: 'Tech',
            department: 'Boliver',
            title: 'Test',
            phones: [{ phone: '123456789', wa_id: 'wa-id-1', type: 'mobile' }],
            emails: [{ email: 'john.doe@example.com', type: 'work' }],
            org: { company: 'Example Corp', department: 'IT', title: 'Engineer' },
            urls: [{ url: 'https://example.com', type: 'website' }],
            addresses: [
                {
                    street: '123 Main St',
                    city: 'City',
                    state: 'State',
                    zip: '12345',
                    country: 'Country',
                    country_code: 'US',
                    type: 'home',
                },
            ],
        },
    ]

    await metaProvider.sendContacts(to, contacts)
    assert.equal(sendMessageMetaStub.calledOnce, true)
    assert.equal(sendMessageMetaStub.firstCall.args[0].contacts.length, 1)
    sendMessageMetaStub.restore()
})

test('sendCatalog should call sendMessageMeta with the correct parameters', async () => {
    const sendMessageMetaStub = stub(metaProvider, 'sendMessageMeta').resolves({})

    const to = '+123456789'
    const bodyText = 'Check out our catalog'
    const itemCatalogId = 'item-123'
    await metaProvider.sendCatalog(to, bodyText, itemCatalogId)
    assert.equal(sendMessageMetaStub.calledOnce, true)
    const expectedBody = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
            type: 'catalog_message',
            body: {
                text: bodyText,
            },
            action: {
                name: 'catalog_message',
                parameters: {
                    thumbnail_product_retailer_id: itemCatalogId,
                },
            },
        },
    }
    assert.equal(JSON.stringify(sendMessageMetaStub.firstCall.args[0]), JSON.stringify(expectedBody))
    assert.ok(sendMessageMetaStub.calledWith(expectedBody))
    sendMessageMetaStub.restore()
})

test('sendMsg should call sendButtons when options.buttons is provided', async () => {
    const sendButtonsStub = stub(metaProvider, 'sendButtons')

    const number = '+123456789'
    const message = 'Hello, world!'
    const options = {
        buttons: [
            { id: '1', title: 'Button 1' },
            { id: '2', title: 'Button 2' },
        ],
    }
    await metaProvider.sendMessage(number, message, { options })
    assert.equal(sendButtonsStub.calledOnce, true)
    const expectedArgs = [number, message, options.buttons]
    assert.equal(JSON.stringify(sendButtonsStub.firstCall.args), JSON.stringify(expectedArgs))
    assert.equal(sendMediaStub.notCalled, true)
    sendButtonsStub.restore()
})

test('sendMsg should call sendMedia when options.media is provided', async () => {
    const sendButtonsStub = stub(metaProvider, 'sendButtons')
    const number = '+123456789'
    const message = 'Hello, world!'
    const options = {
        media: 'https://example.com/image.jpg',
    }

    await metaProvider.sendMessage(number, message, { options })
    assert.equal(sendMediaStub.calledOnce, true)

    const expectedArgs = [number, message, options.media]
    assert.equal(JSON.stringify(sendMediaStub.firstCall.args), JSON.stringify(expectedArgs))
    assert.equal(sendButtonsStub.notCalled, true)
    sendMediaStub.restore()
})

test('sendReaction should call sendMessageMeta with the correct parameters', async () => {
    const sendMessageMetaStub = stub(metaProvider, 'sendMessageMeta').resolves({})
    const number = '+123456789'
    const reaction = { message_id: '123', emoji: '👍' }
    await metaProvider.sendReaction(number, reaction)
    assert.equal(sendMessageMetaStub.calledOnce, true)
    const expectedBody = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: number,
        type: 'reaction',
        reaction: {
            message_id: reaction.message_id,
            emoji: reaction.emoji,
        },
    }

    assert.equal(JSON.stringify(sendMessageMetaStub.firstCall.args[0]), JSON.stringify(expectedBody))
    assert.ok(sendMessageMetaStub.calledWith(expectedBody))

    sendMessageMetaStub.restore()
})

test('sendLocation should call sendMessageMeta with the correct parameters', async () => {
    const sendMessageMetaStub = stub(metaProvider, 'sendMessageMeta')
    const to = '+123456789'
    const localization: Localization = {
        long_number: ' 12.34',
        lat_number: '56.78',
        name: 'Location Name',
        address: '123 Main St',
    }
    await metaProvider.sendLocation(to, localization)
    assert.equal(sendMessageMetaStub.calledOnce, true)

    const expectedBody = {
        messaging_product: 'whatsapp',
        to,
        type: 'location',
        location: {
            name: localization.name,
            address: localization.address,
            longitude: localization.long_number,
            latitude: localization.lat_number,
        },
    }

    assert.equal(JSON.stringify(sendMessageMetaStub.firstCall.args[0]), JSON.stringify(expectedBody))
    assert.ok(sendMessageMetaStub.calledWith(expectedBody))

    sendMessageMetaStub.restore()
})

test('server instance to extend meta endpoint with middleware', async () => {
    stub(metaProvider, 'sendMessageMeta').resolves({})
    metaProvider.http.server.get('/your-route-custom', (_, res) => {
        res.end('Hello World')
    })
    const response = await axios(`http://localhost:3999/your-route-custom`)
    assert.equal(response.status, 200)
    assert.equal(response.data, 'Hello World')
})

test.after(async () => {
    await metaProvider.http.stop()
})

test.run()