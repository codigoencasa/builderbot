import proxyquire from 'proxyquire'
import { stub } from 'sinon'
import twilio from 'twilio'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

const utilsMock = {
    encryptData: stub().returns('kddkdkdk'),
}
const emitStub = stub()
const sendStub = stub()
const createStub = stub()

test.after.each(() => {
    emitStub.resetHistory()
    sendStub.resetHistory()
    createStub.resetHistory()
})

const { TwilioProvider } = proxyquire<typeof import('../src')>('../src', {
    twilio: {
        TwilioSDK: {
            Twilio: class MockTwilio extends twilio.Twilio {
                constructor(accountSid, authToken, opts) {
                    console.log('🎁🎁🎁')
                    super(accountSid, authToken, opts)
                }
            },
            jwt: {
                // Mock de otras propiedades/métodos utilizados en tu código
            },
            // Otras propiedades/métodos utilizados en tu código
        },
        // Otras propiedades/métodos utilizados en tu código
    },
    '@bot-whatsapp/bot': { utils: utilsMock },
})

const twilioProvider = new TwilioProvider({
    accountSid: 'AC',
    authToken: 'ACfakeToken',
    vendorNumber: '123456789',
    port: 3001,
    publicUrl: 'http://localhost',
})

test('sendMessageToApi - should send a message to API', async () => {
    assert.instance(twilioProvider, TwilioProvider)
})

test('busEvents - auth_failure emitir el payload', async () => {
    const payload: any = {
        from: 'status@broadcast',
        type: 'auth_failure',
    }
    twilioProvider.emit = emitStub
    twilioProvider['busEvents']()[0].func(payload)
    assert.equal(emitStub.args[0][0], 'error')
    assert.equal(emitStub.args[0][1].from, payload.from)
    assert.equal(emitStub.args[0][1].type, payload.type)
})

test('busEvents - ready emitir el payload', async () => {
    const payload: any = {
        from: 'status@broadcast',
        type: 'ready',
    }
    twilioProvider.emit = emitStub
    twilioProvider['busEvents']()[1].func(payload)
    assert.equal(emitStub.args[0][0], 'ready')
    assert.equal(emitStub.args[0][1], true)
})

test('busEvents - message I should build the bodysuit for the guy lat y lng', async () => {
    const payload: any = {
        from: '+123456789',
        _data: {
            lat: '1224',
            lng: '1224',
        },
    }
    twilioProvider.emit = emitStub
    twilioProvider['busEvents']()[2].func(payload)
    assert.equal(emitStub.args[0][0], 'message')
    assert.equal(emitStub.args[0][1], payload)
})

test('sendButtons - should emit the notice event', async () => {
    const emitSpect = [
        'notice',
        '[NOTA]: Actualmente enviar botones con Twilio está en desarrollo\n' +
            '[NOTA]: https://www.twilio.com/es-mx/docs/whatsapp/buttons',
    ]
    twilioProvider.emit = emitStub
    twilioProvider['sendButtons']()
    assert.equal(emitStub.firstCall.args[0], 'notice')
    assert.equal(emitStub.args[0], emitSpect)
})

test('sendMessage - should call the method sendButtons', async () => {
    const to = '+123456789'
    const message = 'Test message'
    const argWithButtons: any = {
        options: {
            buttons: ['Button1', 'Button2'],
        },
    }
    twilioProvider['sendButtons'] = sendStub

    twilioProvider.vendor.messages.create = createStub.returns(true)
    const response = await twilioProvider.sendMessage(to, message, argWithButtons)
    assert.equal(sendStub.called, true)
    assert.equal(response, true)
})

test('sendMessage - should call the method sendMedia', async () => {
    const to = '123456789'
    const message = 'Test message'
    const argWithMedia: any = {
        options: {
            media: 'image.jpg',
        },
    }
    twilioProvider['sendMedia'] = sendStub

    twilioProvider.vendor.messages.create = createStub.returns(true)
    await twilioProvider.sendMessage(to, message, argWithMedia)
    assert.equal(sendStub.called, true)
    assert.equal(sendStub.args[0][0], to)
    assert.equal(sendStub.args[0][1], message)
    assert.equal(sendStub.args[0][2], argWithMedia.options.media)
})

test('sendMedia - should include localhost', async () => {
    const twilioProvider = new TwilioProvider({
        accountSid: 'AC',
        authToken: 'ACfakeToken',
        vendorNumber: '123456789',
        port: 5001,
        publicUrl: 'http://localhost',
    })
    const to = '123456789'
    const message = 'Test message'
    twilioProvider.vendor.messages.create = createStub.returns(true)
    const result = await twilioProvider['sendMedia'](to, message, 'localhost')
    assert.equal(result, true)
    assert.equal(createStub.args[0][0].mediaUrl[0].includes('localhost'), true)
    await twilioProvider.http.stop()
})

test('sendMedia - should include 127.0.0.1', async () => {
    const twilioProvider = new TwilioProvider({
        accountSid: 'AC',
        authToken: 'ACfakeToken',
        vendorNumber: '123456789',
        port: 5002,
        publicUrl: 'http://127.0.0.1',
    })
    const to = '123456789'
    const message = 'Test message'
    twilioProvider.vendor.messages.create = createStub.returns(true)
    const result = await twilioProvider['sendMedia'](to, message, '127.0.0.1')
    assert.equal(result, true)
    assert.equal(createStub.args[0][0].mediaUrl[0].includes('127.0.0.1'), true)
    await twilioProvider.http.stop()
})

test('sendMedia -should include 0.0.0.0', async () => {
    const twilioProvider = new TwilioProvider({
        accountSid: 'AC',
        authToken: 'ACfakeToken',
        vendorNumber: '123456789',
        port: 5003,
        publicUrl: 'http://0.0.0.0',
    })
    const to = '123456789'
    const message = 'Test message'
    twilioProvider.vendor.messages.create = createStub.returns(true)
    const result = await twilioProvider['sendMedia'](to, message, '0.0.0.0')
    assert.equal(result, true)
    assert.equal(createStub.args[0][0].mediaUrl[0].includes('0.0.0.0'), true)
    await twilioProvider.http.stop()
})

test('sendMedia - should include 0.0.0.0', async () => {
    const publicUrl = 'https://example.com/media'
    const twilioProvider = new TwilioProvider({
        accountSid: 'AC',
        authToken: 'ACfakeToken',
        vendorNumber: '123456789',
        port: 5004,
        publicUrl,
    })

    const to = '123456789'
    const message = 'Test message'
    twilioProvider.vendor.messages.create = createStub.returns(true)
    const result = await twilioProvider['sendMedia'](to, message, publicUrl)
    assert.equal(result, true)
    assert.equal(createStub.args[0][0].mediaUrl[0].includes(publicUrl), true)
    await twilioProvider.http.stop()
})

test('sendMedia arroja un error si mediaInput es null', async () => {
    const twilioProvider = new TwilioProvider({
        accountSid: 'AC',
        authToken: 'ACfakeToken',
        vendorNumber: '123456789',
        port: 5005,
    })

    try {
        await twilioProvider['sendMedia']('123456789', 'Hola', null)
        assert.unreachable('Did not throw an error for mediaInput null')
    } catch (error) {
        assert.is(error.message, 'MEDIA_INPUT_NULL_: null')
    }
    await twilioProvider.http.stop()
})

test.after(async () => {
    await twilioProvider.http.stop()
})

test.run()
