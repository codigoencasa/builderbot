import { utils } from '@bot-whatsapp/bot'
import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { spy, stub } from 'sinon'
import proxyquire from 'proxyquire'
const mimeMock = {
    lookup: stub(),
}

const utilsMock = {
    generalDownload: stub(),
}

const hookClose = async () => {
    await utils.delay(2000)
    process.exit(0)
}

const { VenomProvider } = proxyquire<typeof import('../src/index')>('../src/index', {
    '@bot-whatsapp/bot': { utils: utilsMock },
    'mime-types': mimeMock,
})
const credentials = { name: 'bot', gifPlayback: false }
const venomProvider = new VenomProvider(credentials)
const initStub = stub()
const emitStub = stub()
const sendStub = stub().resolves('success')

const consoleClearSpy = spy(console, 'clear')

test.after.each(() => {
    initStub.resetHistory()
    emitStub.resetHistory()
    consoleClearSpy.resetHistory()
    sendStub.resetHistory()
})

test('VenomProvider se inicializa correctamente', async () => {
    venomProvider.init = initStub.resolves(true)
    await venomProvider.init()
    assert.equal(initStub.called, true)
    assert.equal(venomProvider.globalVendorArgs.name, credentials.name)
    assert.equal(venomProvider.globalVendorArgs.gifPlayback, credentials.gifPlayback)
})

test('venomProvider - initBusEvents should bind vendor events to corresponding functions', () => {
    const onMessageStub = stub()
    const vendorMock: any = {
        onMessage: onMessageStub,
        close: stub().callsFake(hookClose),
    }
    venomProvider.vendor = vendorMock
    venomProvider.initBusEvents()
    assert.equal(onMessageStub.called, true)
})

test('generateQr - La generación de QR se realiza correctamente', async () => {
    const payloadEmit = {
        instructions: [
            'Debes escanear el QR Code para iniciar bot.qr.png',
            'Recuerda que el QR se actualiza cada minuto ',
            'Necesitas ayuda: https://link.codigoencasa.com/DISCORD',
        ],
    }
    venomProvider.emit = emitStub
    await venomProvider.generateQr('qrCodeString')

    assert.equal(consoleClearSpy.called, true)
    assert.equal(emitStub.args[0][0], 'require_action')
    assert.equal(emitStub.args[0][1], payloadEmit)
})

test('busEvents - onMessage deberia returnar undefined', async () => {
    const payload: any = {
        from: 'status@broadcast',
        type: 'image',
    }
    venomProvider.emit = emitStub
    venomProvider.busEvents()[0].func(payload)
    assert.equal(emitStub.args[0], undefined)
})

test('busEvents - onMessage deberia returnar undefined', async () => {
    const payload: any = {
        from: '123@g.us',
        type: 'image',
    }
    venomProvider.emit = emitStub
    venomProvider.busEvents()[0].func(payload)
    assert.equal(emitStub.args[0], undefined)
})

test('busEvents - onMessage I should build the body suit for the guy imagen', async () => {
    const payload: any = {
        from: '+123456789',
        type: 'image',
    }
    venomProvider.emit = emitStub
    venomProvider.busEvents()[0].func(payload)
    assert.equal(emitStub.args[0][0], 'message')
    assert.equal(emitStub.args[0][1].from, payload.from)
    assert.ok(emitStub.args[0][1].body.includes('_event_media_'))
    assert.ok(emitStub.called)
})

test('busEvents - onMessage I should build the body suit for the guy document', async () => {
    const payload: any = {
        from: '+123456789',
        type: 'document',
    }
    venomProvider.emit = emitStub
    venomProvider.busEvents()[0].func(payload)
    assert.equal(emitStub.args[0][0], 'message')
    assert.equal(emitStub.args[0][1].from, payload.from)
})

test('busEvents - onMessage I should build the body suit for the guy ptt', async () => {
    const payload: any = {
        from: '+123456789',
        type: 'ptt',
    }
    venomProvider.emit = emitStub
    venomProvider.busEvents()[0].func(payload)
    assert.equal(emitStub.args[0][0], 'message')
    assert.equal(emitStub.args[0][1].from, payload.from)
    assert.ok(emitStub.args[0][1].body.includes('_event_voice_note_'))
})

test('busEvents - onMessage I should build the body suit for the guy ptt', async () => {
    const payload: any = {
        from: '+123456789',
        type: 'ptt',
    }
    venomProvider.emit = emitStub
    venomProvider.busEvents()[0].func(payload)
    assert.equal(emitStub.args[0][0], 'message')
    assert.equal(emitStub.args[0][1].from, payload.from)
    assert.ok(emitStub.args[0][1].body.includes('_event_voice_note_'))
})

test('busEvents - onMessage I should build the bodysuit for the guy lat y lng', async () => {
    const payload: any = {
        from: '+123456789',
        lat: '1224',
        lng: '1224',
    }
    venomProvider.emit = emitStub
    venomProvider.busEvents()[0].func(payload)
    assert.equal(emitStub.args[0][0], 'message')
    assert.equal(emitStub.args[0][1].from, payload.from)
    assert.ok(emitStub.args[0][1].body.includes('_event_location_'))
})

test('sendButtons - should send buttons correctly', async () => {
    const payloadEmit = [
        `[NOTA]: Actualmente enviar botones no esta disponible con este proveedor`,
        `[NOTA]: esta funcion esta disponible con Meta o Twilio`,
    ].join('\n')
    const number = '1234567890'
    const message = 'Mensaje con botones'
    const buttons: any = [{ body: 'Botón 1' }, { body: 'Botón 2' }]
    venomProvider.emit = emitStub
    venomProvider.vendor.sendText = sendStub
    await venomProvider.sendButtons(number, message, buttons)
    assert.equal(emitStub.args[0][0], 'notice')
    assert.equal(emitStub.args[0][1], payloadEmit)
    assert.equal(sendStub.args[0][0], number)
    assert.equal(sendStub.called, true)
})

test('sendAudio - should send  audio correctly', async () => {
    const number = '1234567890'
    const audioPath = 'audio.mp3'
    venomProvider.vendor.sendVoice = sendStub
    await venomProvider.sendAudio(number, audioPath)
    assert.equal(sendStub.calledWith(number, audioPath), true)
})

test('sendImage  - should send sendImage correctly', async () => {
    const number = '1234567890'
    const filePath = 'image.png'
    const text = 'Hello Word!'
    venomProvider.vendor.sendImage = sendStub
    await venomProvider.sendImage(number, filePath, text)
    assert.equal(sendStub.calledWith(number, filePath, 'image-name', text), true)
})

test('sendFile   - should send sendFile correctly', async () => {
    const number = '1234567890'
    const filePath = 'file/image.png'
    const text = 'Hello Word!'
    venomProvider.vendor.sendFile = sendStub
    await venomProvider.sendFile(number, filePath, text)
    assert.equal(sendStub.calledWith(number, filePath, 'image.png', text), true)
})

test('sendVideo    - should send sendVideoAsGif correctly', async () => {
    const number = '1234567890'
    const filePath = 'faudio.mp4'
    const text = 'Hello Word!'
    venomProvider.vendor.sendVideoAsGif = sendStub
    await venomProvider.sendVideo(number, filePath, text)
    assert.equal(sendStub.calledWith(number, filePath, 'video.gif', text), true)
})

test('sendMessage - should call the method sendButtons', async () => {
    const to = '+123456789'
    const message = 'Test message'
    const argWithButtons: any = {
        options: {
            buttons: ['Button1', 'Button2'],
        },
    }
    const sendButtonsStub = stub(venomProvider, 'sendButtons').resolves()
    await venomProvider.sendMessage(to, message, argWithButtons)
    assert.equal(sendButtonsStub.called, true)
    assert.equal(sendButtonsStub.args[0][0], `${to}@c.us`)
    assert.equal(sendButtonsStub.args[0][1], message)
    assert.equal(sendButtonsStub.args[0][2], argWithButtons.options.buttons)
})

test('sendMessage - should call the method sendMedia', async () => {
    const to = '+123456789'
    const message = 'Test message'
    const argWithMedia: any = {
        options: {
            media: 'image.jpg',
        },
    }
    const sendMediaStub = stub(venomProvider, 'sendMedia').resolves()
    await venomProvider.sendMessage(to, message, argWithMedia)
    assert.equal(sendMediaStub.called, true)
    assert.equal(sendMediaStub.args[0][0], `${to}@c.us`)
    assert.equal(sendMediaStub.args[0][1], argWithMedia.options.media)
    assert.equal(sendMediaStub.args[0][2], message)
})

test('sendMessage - should call the method  sendText ', async () => {
    const to = '+123456789'
    const message = 'Test message'
    const argWithMedia: any = {}
    venomProvider.vendor.sendText = sendStub
    await venomProvider.sendMessage(to, message, argWithMedia)
    assert.equal(sendStub.called, true)
    assert.equal(sendStub.args[0][0], `${to}@c.us`)
    assert.equal(sendStub.args[0][1], message)
})

test.run()
