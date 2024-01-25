import proxyquire from 'proxyquire'
import { stub } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

const wppconnectMock = {
    create: stub().resolves({ session: true }),
}
const WppConnectGenerateImageStub = stub().resolves()

const { WPPConnectProviderClass } = proxyquire<typeof import('../src')>('../src', {
    '@wppconnect-team/wppconnect': { create: wppconnectMock.create() },
    WppConnectGenerateImage: WppConnectGenerateImageStub(),
})
const wppConnectProvider = new WPPConnectProviderClass({ name: 'testBot' })

test('WPPConnectProviderClass - initWppConnect should call create function with correct options', async () => {
    await wppConnectProvider.initWppConnect()
    assert.equal(wppconnectMock.create.called, true)
    assert.equal(WppConnectGenerateImageStub.called, true)
})

test('WPPConnectProviderClass - initBusEvents should bind vendor events to corresponding functions', () => {
    const onMessageStub = stub()
    const onPollResponseStub = stub()
    const vendorMock: any = {
        onMessage: onMessageStub,
        onPollResponse: onPollResponseStub,
    }
    wppConnectProvider.vendor = vendorMock
    wppConnectProvider.initBusEvents()
    assert.equal(onMessageStub.called, true)
    assert.equal(onPollResponseStub.called, true)
})

test('sendButtons should emit a notice and call vendor.sendText with correct parameters', async () => {
    const emitStub = stub()
    const sendTextStub = stub().resolves('success')
    wppConnectProvider.emit = emitStub
    wppConnectProvider.vendor.sendText = sendTextStub
    const number = '+123456789'
    const text = 'Your Text'
    const buttons = [{ body: 'Button 1' }, { body: 'Button 2' }]
    const result = await wppConnectProvider.sendButtons(number, text, buttons)
    assert.ok(emitStub.calledOnce)
    assert.equal(emitStub.firstCall.args[0], 'notice')
    assert.match(emitStub.firstCall.args[1], /Actualmente enviar botones no esta disponible/)
    assert.ok(sendTextStub.calledOnce)
    assert.equal(sendTextStub.firstCall.args[0], number)
    assert.equal(sendTextStub.firstCall.args[1], text)
    assert.equal(sendTextStub.firstCall.args[2].useTemplateButtons, true)
    assert.equal(sendTextStub.firstCall.args[2].buttons.length, 2)
    assert.equal(sendTextStub.firstCall.args[2].buttons[0].text, 'Button 1')
    assert.equal(sendTextStub.firstCall.args[2].buttons[1].text, 'Button 2')
    assert.equal(result, 'success')
})

test('sendPoll -  It should return false and not call the sendPollMessage method', async () => {
    const sendPollMessageStub = stub().resolves('success')
    wppConnectProvider.vendor.sendPollMessage = sendPollMessageStub
    const number = '+123456789'
    const text = 'Do you accept terms?'
    const poll = { options: ['Yes'], multiselect: true }
    const result = await wppConnectProvider.sendPoll(number, text, poll)
    assert.ok(sendPollMessageStub.notCalled)
    assert.equal(result, false)
})

test('sendPoll - should call vendor.sendPollMessage with correct parameters', async () => {
    const sendPollMessageStub = stub().resolves('success')
    wppConnectProvider.vendor.sendPollMessage = sendPollMessageStub
    const number = '+123456789'
    const text = 'Do you accept terms?'
    const poll = { options: ['Yes', 'No'], multiselect: true }
    const result = await wppConnectProvider.sendPoll(number, text, poll)
    assert.ok(sendPollMessageStub.calledOnce)
    assert.equal(sendPollMessageStub.firstCall.args[0], number)
    assert.equal(sendPollMessageStub.firstCall.args[1], text)
    assert.equal(sendPollMessageStub.firstCall.args[2][0], 'Yes')
    assert.equal(sendPollMessageStub.firstCall.args[2][1], 'No')
    assert.equal(sendPollMessageStub.firstCall.args[3].selectableCount, 1)
    assert.equal(result, 'success')
})

test('sendPoll - should selectableCount equeal 1', async () => {
    const sendPollMessageStub = stub().resolves('success')
    wppConnectProvider.vendor.sendPollMessage = sendPollMessageStub
    const number = '+123456789'
    const text = 'Do you accept terms?'
    const poll = { options: ['Yes', 'No'], multiselect: undefined }
    const result = await wppConnectProvider.sendPoll(number, text, poll)
    assert.ok(sendPollMessageStub.calledOnce)
    assert.equal(sendPollMessageStub.firstCall.args[0], number)
    assert.equal(sendPollMessageStub.firstCall.args[1], text)
    assert.equal(sendPollMessageStub.firstCall.args[2][0], 'Yes')
    assert.equal(sendPollMessageStub.firstCall.args[2][1], 'No')
    assert.equal(sendPollMessageStub.firstCall.args[3].selectableCount, 1)
    assert.equal(result, 'success')
})

test('sendPoll - should selectableCount equeal o', async () => {
    const sendPollMessageStub = stub().resolves('success')
    wppConnectProvider.vendor.sendPollMessage = sendPollMessageStub
    const number = '+123456789'
    const text = 'Do you accept terms?'
    const poll = { options: ['Yes', 'No'], multiselect: false }
    const result = await wppConnectProvider.sendPoll(number, text, poll)
    assert.ok(sendPollMessageStub.calledOnce)
    assert.equal(sendPollMessageStub.firstCall.args[0], number)
    assert.equal(sendPollMessageStub.firstCall.args[1], text)
    assert.equal(sendPollMessageStub.firstCall.args[2][0], 'Yes')
    assert.equal(sendPollMessageStub.firstCall.args[2][1], 'No')
    assert.equal(sendPollMessageStub.firstCall.args[3].selectableCount, 0)
    assert.equal(result, 'success')
})

test('sendPtt - should call vendor.sendPtt with correct parameters', async () => {
    const number = '+123456789'
    const audioPath = 'audio.mp3'
    const sendPttStub = stub().resolves('success')
    wppConnectProvider.vendor.sendPtt = sendPttStub
    await wppConnectProvider.sendPtt(number, audioPath)
    assert.is(sendPttStub.calledOnce, true)
    assert.is(sendPttStub.calledWithExactly(number, audioPath), true)
})

test('sendImage - should call vendor.sendImage with correct parameters', async () => {
    const number = '+123456789'
    const filePath = 'image.jpg'
    const text = 'This is an image'
    const sendImageStub = stub().resolves('success')
    wppConnectProvider.vendor.sendImage = sendImageStub
    await wppConnectProvider.sendImage(number, filePath, text)
    assert.is(sendImageStub.calledOnce, true)
    assert.is(sendImageStub.calledWithExactly(number, filePath, 'image-name', text), true)
})

test('sendFile - should call vendor.sendFile with correct parameters', async () => {
    const number = '+123456789'
    const filePath = 'file.pdf'
    const text = 'This is a file'
    const sendFileStub = stub().resolves('success')
    wppConnectProvider.vendor.sendFile = sendFileStub

    await wppConnectProvider.sendFile(number, filePath, text)
    const fileName = filePath.split('/').pop()
    assert.is(sendFileStub.calledOnce, true)
    assert.is(sendFileStub.calledWithExactly(number, filePath, fileName, text), true)
})

test('sendVideo - should call vendor.sendVideoAsGif with correct parameters', async () => {
    const number = '+123456789'
    const filePath = 'video.mp4'
    const text = 'This is a video'
    const sendVideoStub = stub().resolves('success')
    wppConnectProvider.vendor.sendVideoAsGif = sendVideoStub
    await wppConnectProvider.sendVideo(number, filePath, text)
    assert.is(sendVideoStub.calledOnce, true)
    assert.is(sendVideoStub.calledWithExactly(number, filePath, 'video.gif', text), true)
})

test('sendMessage - should call the method sendButtons', async () => {
    const to = '+123456789'
    const message = 'Test message'
    const argWithButtons: any = {
        options: {
            buttons: ['Button1', 'Button2'],
        },
    }
    const sendButtonsStub = stub(wppConnectProvider, 'sendButtons').resolves()
    await wppConnectProvider.sendMessage(to, message, argWithButtons)
    assert.equal(sendButtonsStub.called, true)
    assert.equal(sendButtonsStub.args[0][0], to)
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

    const sendMediaStub = stub(wppConnectProvider, 'sendMedia').resolves()
    await wppConnectProvider.sendMessage(to, message, argWithMedia)
    assert.equal(sendMediaStub.called, true)
    assert.equal(sendMediaStub.args[0][0], to)
    assert.equal(sendMediaStub.args[0][1], argWithMedia.options.media)
    assert.equal(sendMediaStub.args[0][2], message)
})

test('sendMessage - should call the method vendor.sendText ', async () => {
    const to = '+123456789'
    const message = 'Test message'
    const argWithMedia: any = {}
    const sendTextStub = stub().resolves('success')
    wppConnectProvider.vendor.sendText = sendTextStub
    await wppConnectProvider.sendMessage(to, message, argWithMedia)
    assert.equal(sendTextStub.called, true)
    assert.equal(sendTextStub.args[0][0], to)
    assert.equal(sendTextStub.args[0][1], message)
})

test.run()
