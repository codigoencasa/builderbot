import { utils } from '@builderbot/bot'
import { SendOptions } from '@builderbot/bot/dist/types'
import fsPromises from 'fs/promises'
import proxyquire from 'proxyquire'
import { spy, stub } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

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
    '@builderbot/bot': { utils: utilsMock },
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

test('VenomProvider - initializes correctly', async () => {
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

test('generateQr - QR generation is done correctly', async () => {
    const payloadEmit = {
        title: '⚡⚡ ACTION REQUIRED ⚡⚡',
        instructions: [
            `You must scan the QR Code`,
            `Remember that the QR code updates every minute`,
            `Need help: https://link.codigoencasa.com/DISCORD`,
        ],
    }
    venomProvider.emit = emitStub
    await venomProvider.generateQr('qrCodeString')

    assert.equal(consoleClearSpy.called, true)
    assert.equal(emitStub.args[0][0], 'require_action')
    assert.equal(emitStub.args[0][1], payloadEmit)
})

test('busEvents - onMessage I should return undefined', async () => {
    const payload: any = {
        from: 'status@broadcast',
        type: 'image',
    }
    venomProvider.emit = emitStub
    venomProvider.busEvents()[0].func(payload)
    assert.equal(emitStub.args[0], undefined)
})

test('busEvents - onMessage I should return undefined', async () => {
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
        from: '123456789',
        type: 'document',
    }
    venomProvider.emit = emitStub
    venomProvider.busEvents()[0].func(payload)
    assert.equal(emitStub.args[0][0], 'message')
    assert.equal(emitStub.args[0][1].from, payload.from)
})

test('busEvents - onMessage I should build the body suit for the guy ptt', async () => {
    const payload: any = {
        from: '123456789',
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
        from: '123456789',
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
        from: '123456789',
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
    const payloadEmit = {
        title: 'DEPRECATED',
        instructions: [
            `Currently sending buttons is not available with this provider`,
            `this function is available with Meta or Twilio`,
        ],
    }
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
    const to = '123456789'
    const message = 'Test message'
    const argWithButtons: SendOptions = {
        buttons: [{ body: 'Button1' }, { body: 'Button2' }],
    }
    const sendButtonsStub = stub(venomProvider, 'sendButtons').resolves()
    await venomProvider.sendMessage(to, message, argWithButtons)
    assert.equal(sendButtonsStub.called, true)
    assert.equal(sendButtonsStub.args[0][0], `${to}@c.us`)
    assert.equal(sendButtonsStub.args[0][1], message)
    assert.equal(sendButtonsStub.args[0][2], argWithButtons.buttons)
})

test('sendMessage - should call the method sendMedia', async () => {
    const to = '123456789'
    const message = 'Test message'
    const argWithMedia: SendOptions = {
        media: 'image.jpg',
    }
    const sendMediaStub = stub(venomProvider, 'sendMedia').resolves()
    await venomProvider.sendMessage(to, message, argWithMedia)
    assert.equal(sendMediaStub.called, true)
    assert.equal(sendMediaStub.args[0][0], `${to}@c.us`)
    assert.equal(sendMediaStub.args[0][1], argWithMedia.media)
    assert.equal(sendMediaStub.args[0][2], message)
})

test('sendMessage - should call the method sendText ', async () => {
    const to = '123456789'
    const message = 'Test message'
    const argWithMedia: any = {}
    venomProvider.vendor.sendText = sendStub
    await venomProvider.sendMessage(to, message, argWithMedia)
    assert.equal(sendStub.called, true)
    assert.equal(sendStub.args[0][0], `${to}@c.us`)
    assert.equal(sendStub.args[0][1], message)
})

test('initHttpServer - debería iniciar el servidor HTTP correctamente', async () => {
    const startStub = stub()

    const testPort = 3000
    if (venomProvider.http) {
        venomProvider.http.start = startStub
    }
    venomProvider.sendMessage = sendStub

    venomProvider.initHttpServer(testPort, { blacklist: {} as any })
    assert.equal(startStub.called, true)
    await venomProvider.http?.server.server?.close()
})

test('generateFileName should return a valid filename with provided extension', () => {
    const extension = 'txt'
    const expectedPrefix = 'file-'
    const fixedTimestamp = 1628739872000
    const nowStub = stub(Date, 'now').returns(fixedTimestamp)
    const result = venomProvider['generateFileName'](extension)
    assert.ok(result.startsWith(expectedPrefix))
    assert.ok(result.endsWith(`.${extension}`))
    assert.is(result.length, expectedPrefix.length + extension.length + 1 + fixedTimestamp.toString().length)
    nowStub.restore()
})

test('saveFile  - saves file correctly in path storage', async () => {
    const ctxMock = { mimetype: 'image/jpeg' }
    const fileName = `file-${Date.now()}.jpeg`
    const decryptFileMock = stub().resolves(Buffer.from('file content'))
    const generateFileNameStub = stub().returns(fileName)
    venomProvider.vendor['decryptFile'] = decryptFileMock
    venomProvider['generateFileName'] = generateFileNameStub
    const readFileSyncStub = stub(fsPromises, 'writeFile')
    await venomProvider.saveFile(ctxMock, { path: 'storage' })

    assert.equal(decryptFileMock.called, true)
    assert.equal(decryptFileMock.firstCall.args[0], ctxMock)
    assert.equal(generateFileNameStub.firstCall.args[0], 'jpeg')
    readFileSyncStub.restore()
})

test('saveFile  - saves file correctly in tmpdir', async () => {
    const ctxMock = { mimetype: 'image/jpeg' }
    const fileName = `file-${Date.now()}.jpeg`
    const decryptFileMock = stub().resolves(Buffer.from('file content'))
    const generateFileNameStub = stub().returns(fileName)
    venomProvider.vendor['decryptFile'] = decryptFileMock
    venomProvider['generateFileName'] = generateFileNameStub
    const readFileSyncStub = stub(fsPromises, 'writeFile')
    await venomProvider.saveFile(ctxMock)

    assert.equal(decryptFileMock.called, true)
    assert.equal(decryptFileMock.firstCall.args[0], ctxMock)
    assert.equal(generateFileNameStub.firstCall.args[0], 'jpeg')
    readFileSyncStub.restore()
})

test('saveFile handles errors', async () => {
    const ctxMock = { mimetype: 'image/jpeg' }
    const errorMessage = 'Failed to decrypt file'
    const errorMock = new Error(errorMessage)
    const decryptFileMock = stub().rejects(errorMock)
    venomProvider.vendor['decryptFile'] = decryptFileMock

    try {
        await venomProvider.saveFile(ctxMock, { path: 'storage' })
    } catch (error) {
        assert.equal(error.message, errorMessage)
    }
})

test.run()
