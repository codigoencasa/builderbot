import { utils } from '@bot-whatsapp/bot'
import { SendOptions } from '@bot-whatsapp/bot/dist/types'
import fs from 'fs'
import { stub } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { BaileysProvider } from '../src'
import { WASocket } from '../src/baileyWrapper'
import { ButtonOption } from '../src/type'

const hookClose = async () => {
    await utils.delay(2000)
    process.exit(0)
}

const args = {
    name: 'TestBot',
    gifPlayback: true,
    usePairingCode: true,
    phoneNumber: '+1234567890',
    useBaileysStore: true,
}

const baileysProvider = new BaileysProvider(args)
const vendorMock: any = baileysProvider.vendor
vendorMock.close = stub().callsFake(hookClose)
baileysProvider.vendor = vendorMock

const sendStub = stub().resolves('success')
const emitStub = stub()
const loadMessageStub = stub()

test.after.each(async () => {
    sendStub.resetHistory()
    emitStub.resetHistory()
    loadMessageStub.resetHistory()
})

test('should construct BaileysProvider instance correctly', async () => {
    assert.instance(baileysProvider, BaileysProvider)
    assert.is(baileysProvider.globalVendorArgs.name, args.name)
    assert.is(baileysProvider.globalVendorArgs.gifPlayback, args.gifPlayback)
    assert.is(baileysProvider.globalVendorArgs.usePairingCode, args.usePairingCode)
    assert.is(baileysProvider.globalVendorArgs.phoneNumber, args.phoneNumber)
    assert.is(baileysProvider.globalVendorArgs.useBaileysStore, args.useBaileysStore)
})

test('sendSticker - send a sticker successfully', async () => {
    const remoteJid = '1234546@c.us'
    const fileName = '2whHCbI.png'
    const url = `http://i.imgur.com/${fileName}`
    const stickerOptions = { pack: 'MyPack', author: 'Me' }
    const messages = null
    baileysProvider.vendor.sendMessage = sendStub
    await baileysProvider.sendSticker(remoteJid, url, stickerOptions, messages)
    assert.equal(sendStub.args[0][0], remoteJid)
    assert.equal(sendStub.called, true)
})

test('sendPresenceUpdate - send presence update successfully', async () => {
    const remoteJid = '1338383@c.us'
    const WAPresence = 'recording'
    baileysProvider.vendor.sendPresenceUpdate = sendStub
    await baileysProvider.sendPresenceUpdate(remoteJid, WAPresence)
    assert.equal(sendStub.args[0][0], WAPresence)
    assert.equal(sendStub.args[0][1], remoteJid)
})

test('sendContact - send a contact successfully', async () => {
    const remoteJid = 'xxxxxxxxxxx@c.us'
    const contactNumber = '+123456789'
    const displayName = 'John Doe'
    const messages = 'Hello Word!'
    const expectedContact = {
        vcard:
            'BEGIN:VCARD\n' +
            'VERSION:3.0\n' +
            'FN:John Doe\n' +
            'ORG:Ashoka Uni;\n' +
            'TEL;type=CELL;type=VOICE;waid=123456789:+123456789\n' +
            'END:VCARD',
    }
    baileysProvider.vendor.sendMessage = sendStub
    await baileysProvider.sendContact(remoteJid, { replaceAll: () => contactNumber }, displayName, messages)
    assert.equal(sendStub.args[0][0], remoteJid)
    assert.equal(sendStub.args[0][1].contacts.displayName, '.')
    assert.equal(sendStub.args[0][1].contacts.contacts[0], expectedContact)
    assert.equal(sendStub.args[0][2].quoted, messages)
})

test('sendLocation - send a location successfully', async () => {
    const remoteJid = '1224445@c.us'
    const latitude = 40.7128
    const longitude = -74.006
    const messages = 'Hello Word!'
    const expectedLocation = { location: { degreesLatitude: 40.7128, degreesLongitude: -74.006 } }
    baileysProvider.vendor.sendMessage = sendStub
    await baileysProvider.sendLocation(remoteJid, latitude, longitude, messages)
    assert.equal(sendStub.args[0][0], remoteJid)
    assert.equal(sendStub.args[0][1], expectedLocation)
    assert.equal(sendStub.args[0][2].quoted, messages)
})

test('sendMessage - should call the method sendButtons', async () => {
    const to = '+123456789'
    const message = 'Test message'
    const argWithButtons: SendOptions = {
        options: {
            buttons: ['Button1', 'Button2'],
        },
    }
    baileysProvider['sendButtons'] = sendStub
    const response = await baileysProvider.sendMessage(to, message, argWithButtons)
    assert.equal(sendStub.called, true)
    assert.equal(response, 'success')
    assert.equal(sendStub.args[0][0], '+123456789@s.whatsapp.net')
    assert.equal(sendStub.args[0][1], message)
    assert.equal(sendStub.args[0][2], ['Button1', 'Button2'])
})

test('sendMessage - should call the method sendMedia', async () => {
    const to = '+123456789'
    const message = 'Test message'
    const argWithButtons: SendOptions = {
        media: 'image.jpg',
    }
    baileysProvider['sendMedia'] = sendStub
    const response = await baileysProvider.sendMessage(to, message, argWithButtons)
    assert.equal(sendStub.called, true)
    assert.equal(response, 'success')
    assert.equal(sendStub.args[0][0], '+123456789@s.whatsapp.net')
    assert.equal(sendStub.args[0][1], argWithButtons.media)
    assert.equal(sendStub.args[0][2], message)
})

test('sendMessage - should call the method sendText', async () => {
    const to = '+123456789'
    const message = 'Test message'
    const argWithButtons: SendOptions = {}
    baileysProvider['sendText'] = sendStub
    const response = await baileysProvider.sendMessage(to, message, argWithButtons)
    assert.equal(sendStub.called, true)
    assert.equal(response, 'success')
    assert.equal(sendStub.args[0][0], '+123456789@s.whatsapp.net')
    assert.equal(sendStub.args[0][1], message)
})

test('sendPoll - Deberia retornar false', async () => {
    const remoteJid = '122445@c.us'
    const text = '¿Qué opción prefieres?'
    const poll = {
        options: [],
        multiselect: false,
    }
    const result = await baileysProvider.sendPoll(remoteJid, text, poll)
    assert.equal(result, false)
})

test('sendPoll - sendPoll sends the poll successfully', async () => {
    const remoteJid = '122445@c.us'
    const text = '¿Qué opción prefieres?'
    const poll = {
        options: ['Opción A', 'Opción B', 'Opción C'],
        multiselect: true,
    }
    baileysProvider.vendor.sendMessage = sendStub
    await baileysProvider.sendPoll(remoteJid, text, poll)
    assert.equal(sendStub.args[0][0], '122445@c.us@s.whatsapp.net')
})

test('sendPoll - sendPoll sends the poll successfully', async () => {
    const remoteJid = '122445@c.us'
    const text = '¿Qué opción prefieres?'
    const poll = {
        options: ['Opción A', 'Opción B', 'Opción C'],
        multiselect: false,
    }
    baileysProvider.vendor.sendMessage = sendStub
    await baileysProvider.sendPoll(remoteJid, text, poll)
    assert.equal(sendStub.args[0][0], '122445@c.us@s.whatsapp.net')
})

test('sendPoll - sendPoll sends the poll successfully', async () => {
    const remoteJid = '122445@c.us'
    const text = '¿Qué opción prefieres?'
    const poll = {
        options: ['Opción A', 'Opción B', 'Opción C'],
        multiselect: undefined,
    }
    baileysProvider.vendor.sendMessage = sendStub
    await baileysProvider.sendPoll(remoteJid, text, poll)
    assert.equal(sendStub.args[0][0], '122445@c.us@s.whatsapp.net')
})

test('sendButtons - must send buttons correctly', async () => {
    const provider = new BaileysProvider({})
    const remoteJid = '122445@c.us'
    const text = '¿Qué opción prefieres?'
    const buttons: ButtonOption[] = [{ body: 'Button 1' }, { body: 'Button 2' }]
    const expectedButtons = [
        {
            buttonId: 'id-btn-0',
            buttonText: { displayText: 'Button 1' },
            type: 1,
        },
        {
            buttonId: 'id-btn-1',
            buttonText: { displayText: 'Button 2' },
            type: 1,
        },
    ]
    provider.emit = emitStub
    provider.vendor.sendMessage = sendStub
    await provider.sendButtons(remoteJid, text, buttons)
    assert.equal(sendStub.args[0][0], '122445@c.us@s.whatsapp.net')
    assert.equal(emitStub.args[0][0], 'notice')
    assert.equal(sendStub.args[0][1].text, text)
    assert.equal(sendStub.args[0][1].buttons, expectedButtons)
})

test('sendFile - should send the file correctly', async () => {
    const remoteJid = '122445@c.us'
    const filePath = './path/to/file.pdf'
    baileysProvider.vendor.sendMessage = sendStub
    const expectedPayload = {
        document: { url: './path/to/file.pdf' },
        mimetype: 'application/pdf',
        fileName: 'file.pdf',
    }
    const result = await baileysProvider.sendFile(remoteJid, filePath)
    assert.equal(result, 'success')
    assert.equal(sendStub.args[0][0], remoteJid)
    assert.equal(sendStub.args[0][1], expectedPayload)
})

test('sendText  - should send the text correctly', async () => {
    const provider = new BaileysProvider({})
    const remoteJid = '122445@c.us'
    const message = 'Test message'
    provider.vendor.sendMessage = sendStub
    const expectedPayload = { text: 'Test message' }
    const result = await provider.sendText(remoteJid, message)
    assert.equal(result, 'success')
    assert.equal(sendStub.args[0][0], remoteJid)
    assert.equal(sendStub.args[0][1], expectedPayload)
})

test('sendAudio  - should send the audio correctly', async () => {
    const remoteJid = '122445@c.us'
    const message = 'Test message'
    baileysProvider.vendor.sendMessage = sendStub
    const expectedPayload = { audio: { url: 'Test message' }, ptt: true }
    const result = await baileysProvider.sendAudio(remoteJid, message)
    assert.equal(result, 'success')
    assert.equal(sendStub.args[0][0], remoteJid)
    assert.equal(sendStub.args[0][1], expectedPayload)
})

test('getMessage - deberia retornar un objeto vacio', async () => {
    const key = {
        remoteJid: 'ejemplo@whatsapp.com',
        id: '1234567890',
    }
    const message = await baileysProvider['getMessage'](key)
    assert.equal(message, undefined)
})

test('getMessage - deberia retornar el mensaje de hola Mundo', async () => {
    const key = {
        remoteJid: 'ejemplo@whatsapp.com',
        id: '1234567890',
    }

    if (baileysProvider.store) {
        baileysProvider.store.loadMessage = loadMessageStub.resolves({ msg: { message: 'Hello' } })
    }
    await baileysProvider['getMessage'](key)
    assert.equal(loadMessageStub.args[0][0], key.remoteJid)
    assert.equal(loadMessageStub.args[0][1], key.id)
})

test('initBusEvents asigna correctamente los eventos al socket', () => {
    const socketStub = {
        ev: {
            on: stub(),
        },
    } as any
    baileysProvider['initBusEvents'](socketStub as WASocket)
    assert.equal(socketStub.ev.on.called, true)
})

test('busEvents - messages.upsert should not broadcast a message', () => {
    const payload: any = {
        type: 'test',
        messages: [{ message: { protocolMessage: { type: 'EPHEMERAL_SETTING' } } }],
    }
    baileysProvider.emit = emitStub
    baileysProvider['busEvents']()[0].func(payload)
    assert.equal(emitStub.notCalled, true)
})

test('busEvents - messages.upsert should not broadcast a message', () => {
    const payload: any = {
        type: 'notify',
        messages: [{ message: { protocolMessage: { type: 'EPHEMERAL_SETTING' } } }],
    }
    baileysProvider.emit = emitStub
    baileysProvider['busEvents']()[0].func(payload)
    assert.equal(emitStub.notCalled, true)
})

test('busEvents - messages.upsert should broadcast a location message', () => {
    const payload: any = {
        type: 'notify',
        messages: [
            {
                message: {
                    protocolMessage: { type: 'OTHER' },
                    locationMessage: { degreesLatitude: 11223, degreesLongitude: 11223 },
                },
                extendedTextMessage: { text: 'Hello' },
                pushName: 'test',
                key: { remoteJid: '133354' },
            },
        ],
    }
    const expectedEmit = {
        message: {
            protocolMessage: { type: 'OTHER' },
            locationMessage: { degreesLatitude: 11223, degreesLongitude: 11223 },
        },
    }
    baileysProvider.emit = emitStub
    baileysProvider['busEvents']()[0].func(payload)
    assert.equal(emitStub.args[0][0], 'message')
    assert.equal(emitStub.args[0][1].message, expectedEmit.message)
    assert.equal(emitStub.args[0][1].body.includes('_event_location_'), true)
})

test('busEvents - messages.upsert should broadcast a video message', () => {
    const payload: any = {
        type: 'notify',
        messages: [
            {
                message: {
                    protocolMessage: { type: 'OTHER' },
                    videoMessage: 'videp.mp4',
                },
                extendedTextMessage: { text: 'Hello' },
                pushName: 'test',
                key: { remoteJid: '133354' },
            },
        ],
    }
    const expectedEmit = {
        message: {
            protocolMessage: { type: 'OTHER' },
            videoMessage: 'videp.mp4',
        },
    }
    baileysProvider.emit = emitStub
    baileysProvider['busEvents']()[0].func(payload)
    assert.equal(emitStub.args[0][0], 'message')
    assert.equal(emitStub.args[0][1].message, expectedEmit.message)
    assert.equal(emitStub.args[0][1].body.includes('_event_media_'), true)
})

test('busEvents - messages.upsert should broadcast a sticker message', () => {
    const payload: any = {
        type: 'notify',
        messages: [
            {
                message: {
                    protocolMessage: { type: 'OTHER' },
                    stickerMessage: 'sticker.png',
                },
                extendedTextMessage: { text: 'Hello' },
                pushName: 'test',
                key: { remoteJid: '133354' },
            },
        ],
    }
    const expectedEmit = {
        message: {
            protocolMessage: { type: 'OTHER' },
            stickerMessage: 'sticker.png',
        },
    }
    baileysProvider.emit = emitStub
    baileysProvider['busEvents']()[0].func(payload)
    assert.equal(emitStub.args[0][0], 'message')
    assert.equal(emitStub.args[0][1].message, expectedEmit.message)
    assert.equal(emitStub.args[0][1].body.includes('_event_media_'), true)
})

test('busEvents - messages.upsert should broadcast a image message', () => {
    const payload: any = {
        type: 'notify',
        messages: [
            {
                message: {
                    protocolMessage: { type: 'OTHER' },
                    imageMessage: 'image.png',
                },
                extendedTextMessage: { text: 'Hello' },
                pushName: 'test',
                key: { remoteJid: '133354' },
            },
        ],
    }
    const expectedEmit = {
        message: {
            protocolMessage: { type: 'OTHER' },
            imageMessage: 'image.png',
        },
    }
    baileysProvider.emit = emitStub
    baileysProvider['busEvents']()[0].func(payload)
    assert.equal(emitStub.args[0][0], 'message')
    assert.equal(emitStub.args[0][1].message, expectedEmit.message)
    assert.equal(emitStub.args[0][1].body.includes('_event_media_'), true)
})

test('busEvents -  messages.upsert should broadcast a audio message', () => {
    const payload: any = {
        type: 'notify',
        messages: [
            {
                message: {
                    protocolMessage: { type: 'OTHER' },
                    audioMessage: 'audio.mp3',
                },
                extendedTextMessage: { text: 'Hello' },
                pushName: 'test',
                key: { remoteJid: '133354' },
            },
        ],
    }
    const expectedEmit = {
        message: {
            protocolMessage: { type: 'OTHER' },
            audioMessage: 'audio.mp3',
        },
    }
    baileysProvider.emit = emitStub
    baileysProvider['busEvents']()[0].func(payload)
    assert.equal(emitStub.args[0][0], 'message')
    assert.equal(emitStub.args[0][1].message, expectedEmit.message)
})

test('busEvents - messages.upsert should broadcast a document message', () => {
    const payload: any = {
        type: 'notify',
        messages: [
            {
                message: {
                    protocolMessage: { type: 'OTHER' },
                    documentMessage: 'document.pdf',
                },
                extendedTextMessage: { text: 'Hello' },
                pushName: 'test',
                key: { remoteJid: '133354' },
            },
        ],
    }
    const expectedEmit = {
        message: {
            protocolMessage: { type: 'OTHER' },
            documentMessage: 'document.pdf',
        },
    }
    baileysProvider.emit = emitStub
    baileysProvider['busEvents']()[0].func(payload)
    assert.equal(emitStub.args[0][0], 'message')
    assert.equal(emitStub.args[0][1].message, expectedEmit.message)
    assert.equal(emitStub.args[0][1].body.includes('_event_document_'), true)
})

test('busEvents - messages.update should broadcast a document message', () => {
    const message = [
        {
            key: { remoteJid: '@s.whatsapp.net' },
            update: {
                pollUpdates: [
                    {
                        pollUpdateMessageKey: { remoteJid: '@s.whatsapp.net', id: 1 },
                    },
                ],
            },
        },
    ]

    const getMessageStub = stub().resolves(true)
    baileysProvider['getMessage'] = getMessageStub
    baileysProvider.emit = emitStub

    baileysProvider['busEvents']()[1].func(message)
    assert.equal(getMessageStub.args[0][0], { remoteJid: '@s.whatsapp.net' })
})

test('initHttpServer - debería iniciar el servidor HTTP correctamente', async () => {
    const startStub = stub()

    const testPort = 3000
    if (baileysProvider.http) {
        baileysProvider.http.start = startStub
    }
    baileysProvider.sendMessage = sendStub

    baileysProvider.initHttpServer(testPort)
    assert.equal(startStub.called, true)
    await baileysProvider.http?.server.server?.close()
})

test('sendImage function sends image message with caption', async () => {
    const to = '1234567890'
    const message = 'Hello Word!'
    const image = 'image.png'
    const pathFile = 'test'
    const readFileSyncStub = stub(fs, 'readFileSync').returns(image)
    baileysProvider.vendor.sendMessage = sendStub
    await baileysProvider.sendImage(to, pathFile, message)
    assert.equal(sendStub.called, true)
    assert.equal(sendStub.args[0][0], to)
    assert.equal(sendStub.args[0][1].image, image)
    assert.equal(sendStub.args[0][1].caption, message)
    readFileSyncStub.restore()
})

test('sendVideo  function sends video message with caption', async () => {
    const to = '1234567890'
    const message = 'Hello Word!'
    const video = 'vide.mp4'
    const pathFile = 'test'
    const readFileSyncStub = stub(fs, 'readFileSync').returns(video)
    baileysProvider.vendor.sendMessage = sendStub
    await baileysProvider.sendVideo(to, pathFile, message)
    assert.equal(sendStub.called, true)
    assert.equal(sendStub.args[0][0], to)
    assert.equal(sendStub.args[0][1].caption, message)
    assert.equal(sendStub.args[0][1].video, video)
    assert.equal(sendStub.args[0][1].gifPlayback, true)
    readFileSyncStub.restore()
})

test('generateFileName should return a valid filename with provided extension', () => {
    const extension = 'txt'
    const expectedPrefix = 'file-'
    const fixedTimestamp = 1628739872000
    const nowStub = stub(Date, 'now').returns(fixedTimestamp)
    const result = baileysProvider['generateFileName'](extension)
    assert.ok(result.startsWith(expectedPrefix))
    assert.ok(result.endsWith(`.${extension}`))
    assert.is(result.length, expectedPrefix.length + extension.length + 1 + fixedTimestamp.toString().length)
    nowStub.restore()
})

test('getMimeType - should return the file type image/jpeg ', () => {
    const imageMessage = {
        mimetype: 'image/jpeg',
    }

    const ctx: any = {
        message: {
            imageMessage,
        },
    }

    const result = baileysProvider['getMimeType'](ctx)
    assert.equal(result, 'image/jpeg')
})

test('getMimeType - should return the file type video/mp4 ', () => {
    const videoMessage = {
        mimetype: 'video/mp4',
    }
    const ctx: any = {
        message: {
            videoMessage,
        },
    }

    const result = baileysProvider['getMimeType'](ctx)
    assert.equal(result, 'video/mp4')
})

test('getMimeType - should return the file type application/pdf ', () => {
    const documentMessage = {
        mimetype: 'application/pdf',
    }
    const ctx: any = {
        message: {
            documentMessage,
        },
    }

    const result = baileysProvider['getMimeType'](ctx)
    assert.equal(result, 'application/pdf')
})

test('getMimeType - should return undefined if no message is provided', () => {
    const ctx: any = { message: undefined }
    const result = baileysProvider['getMimeType'](ctx)
    assert.is(result, undefined)
})

test('saveFile should save the file properly', async () => {
    try {
        const ctx: any = {
            key: {},
            message: null,
        }
        baileysProvider['getMimeType'] = stub().returns(undefined)

        const result = await baileysProvider.saveFile(ctx)

        console.log(result)
    } catch (error) {
        assert.equal(error.message, 'MIME type not found')
    }
})

test.after.each(() => {
    hookClose().then()
})

test.run()
