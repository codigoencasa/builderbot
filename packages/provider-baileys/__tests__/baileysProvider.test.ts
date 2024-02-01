import { utils } from '@bot-whatsapp/bot'
import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { stub } from 'sinon'

import { BaileysProvider } from '../src'

const hookClose = async () => {
    await utils.delay(5000)
    process.exit(0)
}

const args = {
    name: 'TestBot',
    gifPlayback: true,
    usePairingCode: false,
    phoneNumber: '+1234567890',
    useBaileysStore: true,
}

const baileysProvider = new BaileysProvider(args)
const vendorMock: any = baileysProvider.vendor
vendorMock.close = stub().callsFake(hookClose)
baileysProvider.vendor = vendorMock

const sendStub = stub()

test('should construct BaileysProvider instance correctly', async () => {
    assert.instance(baileysProvider, BaileysProvider)
    assert.is(baileysProvider.globalVendorArgs.name, args.name)
    assert.is(baileysProvider.globalVendorArgs.gifPlayback, args.gifPlayback)
    assert.is(baileysProvider.globalVendorArgs.usePairingCode, args.usePairingCode)
    assert.is(baileysProvider.globalVendorArgs.phoneNumber, args.phoneNumber)
    assert.is(baileysProvider.globalVendorArgs.useBaileysStore, args.useBaileysStore)
})

// test('sendSticker envía un sticker correctamente', async () => {
//   const remoteJid = 'xxxxxxxxxxx@c.us';
//   const url = 'https://example.com/sticker.png';
//   const stickerOptions = { pack: 'MyPack', author: 'Me' };
//   const messages = null;
//   const stickerStub = stub().returns({
//     async toMessage() {
//       return Buffer.from('sticker_buffer_data');
//     }
//   });
//   const originalSticker = globalThis.Sticker;
//   globalThis.Sticker = stickerStub;
//   baileysProvider.vendor = sendStub()

//   await baileysProvider.sendSticker(remoteJid, url, stickerOptions, messages);
//   console.log(sendStub);

// });
test('sendSticker envía un sticker correctamente', async () => {
    // Configurar el entorno de prueba
    const provider = new BaileysProvider({})
    const remoteJid = 'xxxxxxxxxxx@c.us' // Reemplaza con un valor adecuado
    const url = 'https://example.com/sticker.png' // URL de ejemplo para el sticker
    const stickerOptions = { pack: 'MyPack', author: 'Me' }
    const messages = null // Puedes proporcionar un mensaje de referencia si es necesario

    // Crear un stub para la clase Sticker
    const toMessageStub = stub().resolves(Buffer.from('sticker_buffer_data'))
    const StickerStub = stub().returns({
        toMessage: toMessageStub,
    })

    // Espiar el método sendMessage del objeto vendor
    // const sendMessageSpy = spy(provider.vendor, 'sendMessage');
    baileysProvider.vendor = sendStub()

    // Reemplazar la clase Sticker real con el stub
    const originalSticker = globalThis.Sticker
    globalThis.Sticker = StickerStub

    // Ejecutar la función sendSticker
    await provider.sendSticker(remoteJid, url, stickerOptions, messages)
    console.log(sendStub)

    // Restaurar la clase Sticker original
    globalThis.Sticker = originalSticker
})

test.after.each(() => {
    sendStub.resetHistory()
    hookClose().then()
})

test.run()
