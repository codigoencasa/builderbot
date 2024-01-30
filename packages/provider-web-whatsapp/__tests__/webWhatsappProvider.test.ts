import { utils } from '@bot-whatsapp/bot'
import { stub } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { Buttons } from 'whatsapp-web.js'

import { WebWhatsappProvider } from '../src/index'

const hookClose = async () => {
    await utils.delay(2000)
    process.exit(0)
}

const webWhatsappProvider = new WebWhatsappProvider({ name: 'bot', gifPlayback: false })

const vendorMock: any = webWhatsappProvider.vendor
vendorMock.close = hookClose
webWhatsappProvider.vendor = vendorMock

const emitStub = stub()
const sendStub = stub().resolves('success')

test.after.each(() => {
    sendStub.resetHistory()
    emitStub.resetHistory()
})

test('sendMessage - should call the method sendButtons', async () => {
    const to = '+123456789'
    const message = 'Test message'
    const argWithButtons: any = {
        options: {
            buttons: ['Button1', 'Button2'],
        },
    }
    const sendButtonsStub = stub(webWhatsappProvider, 'sendButtons').resolves()
    await webWhatsappProvider.sendMessage(to, message, argWithButtons)
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
    const sendMediaStub = stub(webWhatsappProvider, 'sendMedia').resolves()
    await webWhatsappProvider.sendMessage(to, message, argWithMedia)
    assert.equal(sendMediaStub.called, true)
    assert.equal(sendMediaStub.args[0][0], `${to}@c.us`)
    assert.equal(sendMediaStub.args[0][1], argWithMedia.options.media)
    assert.equal(sendMediaStub.args[0][2], message)
})

test('sendMessage - should call the method  sendText ', async () => {
    const to = '+123456789'
    const message = 'Test message'
    const argWithMedia: any = {}
    const sendTextStub = stub(webWhatsappProvider, 'sendText').resolves()
    await webWhatsappProvider.sendMessage(to, message, argWithMedia)
    assert.equal(sendTextStub.called, true)
    assert.equal(sendTextStub.args[0][0], `${to}@c.us`)
    assert.equal(sendTextStub.args[0][1], message)
})

test('busEvents - auth_failure emitir el payload', async () => {
    const payload: any = {
        from: 'status@broadcast',
        type: 'auth_failure',
    }
    webWhatsappProvider.emit = emitStub
    webWhatsappProvider.busEvents()[0].func(payload)
    assert.equal(emitStub.args[0][0], 'error')
    assert.equal(emitStub.args[0][1].from, payload.from)
    assert.equal(emitStub.args[0][1].type, payload.type)
})

test('busEvents - qr issue the payload', async () => {
    const payload: any = {
        type: 'qr',
    }
    const dataSpect = {
        instructions: [
            'Debes escanear el QR Code para iniciar bot.qr.png',
            'Recuerda que el QR se actualiza cada minuto ',
            'Necesitas ayuda: https://link.codigoencasa.com/DISCORD',
        ],
    }
    webWhatsappProvider.emit = emitStub
    webWhatsappProvider.busEvents()[1].func(payload.type)
    assert.equal(emitStub.args[0][0], 'require_action')
    assert.equal(emitStub.args[0][1], dataSpect)
})

test('busEvents - qr issue the payload', async () => {
    const payload: any = {
        type: 'ready',
    }
    const dataSpect = { user: '173733', phone: '173733' }
    webWhatsappProvider.vendor.info = { wid: { user: '173733' } } as any
    webWhatsappProvider.emit = emitStub
    webWhatsappProvider.busEvents()[2].func(payload)
    assert.equal(emitStub.args[0][0], 'ready')
    assert.equal(emitStub.args[0][1], true)
    assert.equal(emitStub.args[1][0], 'host')
    assert.equal(emitStub.args[1][1], dataSpect)
})

test('busEvents - message should return undefined', async () => {
    const payload: any = {
        from: 'status@broadcast',
        type: 'image',
    }
    webWhatsappProvider.emit = emitStub
    webWhatsappProvider.busEvents()[3].func(payload)
    assert.equal(emitStub.args[0], undefined)
})

test('busEvents - message should return undefined', async () => {
    const payload: any = {
        from: '123@g.us',
        type: 'image',
    }
    webWhatsappProvider.emit = emitStub
    webWhatsappProvider.busEvents()[3].func(payload)
    assert.equal(emitStub.args[0], undefined)
})

test('busEvents - message I should build the bodysuit for the guy lat y lng', async () => {
    const payload: any = {
        from: '+123456789',
        _data: {
            lat: '1224',
            lng: '1224',
        },
    }
    webWhatsappProvider.emit = emitStub
    webWhatsappProvider.busEvents()[3].func(payload)
    assert.equal(emitStub.args[0][0], 'message')
    assert.equal(emitStub.args[0][1].from, payload.from)
    assert.ok(emitStub.args[0][1].body.includes('_event_location_'))
})

test('busEvents - message I should build the body suit for the guy imagen', async () => {
    const payload: any = {
        from: '+123456789',
        type: 'image',
        _data: {
            type: 'image',
        },
    }
    webWhatsappProvider.emit = emitStub
    webWhatsappProvider.busEvents()[3].func(payload)
    assert.equal(emitStub.args[0][0], 'message')
    assert.equal(emitStub.args[0][1].from, payload.from)
    assert.ok(emitStub.called)
})

test('busEvents - message I should build the body suit for the guy document', async () => {
    const payload: any = {
        from: '+123456789',
        _data: {
            type: 'document',
        },
    }
    webWhatsappProvider.emit = emitStub
    webWhatsappProvider.busEvents()[3].func(payload)
    assert.equal(emitStub.args[0][0], 'message')
    assert.equal(emitStub.args[0][1].from, payload.from)
    assert.ok(emitStub.called)
})

test('busEvents - message I should build the body suit for the guy ptt', async () => {
    const payload: any = {
        from: '+123456789',
        _data: {
            type: 'ptt',
        },
    }
    webWhatsappProvider.emit = emitStub
    webWhatsappProvider.busEvents()[3].func(payload)
    assert.equal(emitStub.args[0][0], 'message')
    assert.equal(emitStub.args[0][1].from, payload.from)
    assert.ok(emitStub.called)
})

test('sendButtons - should send a buttons message correctly', async () => {
    const number = '+1234567890'
    const message = 'Mensaje con botones'
    const buttons: any = [{ body: 'Botón 1' }, { body: 'Botón 2' }]
    const webWhatsappProvider = new WebWhatsappProvider({ name: 'bot', gifPlayback: false })
    webWhatsappProvider.emit = emitStub
    webWhatsappProvider.vendor.sendMessage = sendStub
    const result = await webWhatsappProvider.sendButtons(number, message, buttons)
    assert.equal(emitStub.args[0][0], 'notice')
    assert.is(sendStub.calledOnce, true)
    assert.is(sendStub.firstCall.args[0], number)
    assert.instance(sendStub.firstCall.args[1], Buttons)
    assert.is(result, 'success')
})

test('sendText - should send a text message correctly', async () => {
    const number = '+1234567890'
    const message = 'Mensaje con botones'
    const webWhatsappProvider = new WebWhatsappProvider({ name: 'bot', gifPlayback: false })
    webWhatsappProvider.vendor.sendMessage = sendStub
    const result = await webWhatsappProvider.sendText(number, message)
    assert.is(sendStub.calledOnce, true)
    assert.is(sendStub.firstCall.args[0], number)
    assert.is(sendStub.firstCall.args[1], message)
    assert.is(result, 'success')
})

test.after(async () => (webWhatsappProvider.vendor as any).close())

test.run()
