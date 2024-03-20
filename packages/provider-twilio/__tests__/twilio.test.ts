import proxyquire from 'proxyquire'
import { stub } from 'sinon'
import twilio from 'twilio'
import { ClientOpts } from 'twilio/lib/base/BaseTwilio'
import { suite } from 'uvu'
import * as assert from 'uvu/assert'

import { TwilioRequestBody } from '../src/types'

const utilsMock = {
    encryptData: stub().returns('kddkdkdk'),
    generalDownload: stub(),
}
const emitStub = stub()
const sendStub = stub()
const createStub = stub()

const { TwilioProvider } = proxyquire<typeof import('../src')>('../src', {
    twilio: {
        TwilioSDK: {
            Twilio: class MockTwilio extends twilio.Twilio {
                constructor(
                    accountSid: string | undefined,
                    authToken: string | undefined,
                    opts: ClientOpts | undefined
                ) {
                    super(accountSid, authToken, opts)
                }
            },
            jwt: {},
        },
    },
    '@builderbot/bot': { utils: utilsMock },
})

const twilioProvider = new TwilioProvider({
    accountSid: 'AC',
    authToken: 'ACfakeToken',
    vendorNumber: '123456789',
    publicUrl: 'http://localhost',
})

const test = suite('Provider Meta: Test')

test.after.each(() => {
    emitStub.resetHistory()
    sendStub.resetHistory()
    createStub.resetHistory()
})

test.before(() => {
    twilioProvider.initHttpServer(3001, { blacklist: {} as any })
})

// test.after(async () => {
//     if (twilioProvider.http) await twilioProvider.http.stop()
// })

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
    twilioProvider.vendor.messages.create = createStub.returns(true)
    await twilioProvider.sendMessage(to, message, argWithMedia)
    assert.equal(createStub.called, true)
})

test('sendMedia - should include localhost', async () => {
    const to = '123456789'
    const message = 'Test message'
    const url = 'http://localhost:3000/store/image.png'

    twilioProvider.vendor.messages.create = createStub.returns(true)
    twilioProvider['sendMedia'] = sendStub
    await twilioProvider['sendMedia'](to, message, url)
    assert.equal(sendStub.called, true)
    assert.equal(sendStub.args[0][2], url)
})

test('sendMedia - should include 127.0.0.1', async () => {
    const to = '123456789'
    const message = 'Test message'
    const url = 'http://127.0.0.1:3000/store/image.png'

    twilioProvider.vendor.messages.create = createStub.returns(true)
    twilioProvider['sendMedia'] = sendStub
    await twilioProvider['sendMedia'](to, message, url)
    assert.equal(sendStub.called, true)
    assert.equal(sendStub.args[0][2], url)
})

test('sendMedia arroja un error si mediaInput es null', async () => {
    try {
        const inTwilioProvider = new TwilioProvider({
            accountSid: 'AC',
            authToken: 'ACfakeToken',
            vendorNumber: '123456789',
            publicUrl: 'http://localhost',
        })

        inTwilioProvider.initHttpServer(5994, { blacklist: {} as any })
        inTwilioProvider['sendMedia']('123456789', 'Hola', null).catch((e) =>
            assert.equal(e.message, 'Media cannot be null')
        )
        await inTwilioProvider.http.stop()
    } catch (e) {
        assert.equal(e.message, 'Media cannot be null')
    }
})

test('Deberia retornar el path en la ruta tpm de la imagen', async () => {
    const ctx: TwilioRequestBody = {
        From: '1234',
        To: '4444',
        Body: 'Hello',
        NumMedia: '33344',
        MediaUrl0: 'https://example.com/file.jpg',
    }
    utilsMock.generalDownload.call(() => '/tmp')
    const result = await twilioProvider.saveFile(ctx)
    assert.equal(utilsMock.generalDownload.called, true)
    assert.equal(result.includes('file'), true)
})

test.run()
