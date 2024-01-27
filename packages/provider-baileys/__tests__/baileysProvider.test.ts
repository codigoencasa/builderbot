import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { BaileysProvider } from '../src'

const args = {
    name: 'TestBot',
    gifPlayback: true,
    usePairingCode: false,
    phoneNumber: '+1234567890',
    useBaileysStore: true,
}

const baileysProvider = new BaileysProvider(args)

test.skip('should construct BaileysProvider instance correctly', async () => {
    assert.instance(baileysProvider, BaileysProvider)
    assert.is(baileysProvider.globalVendorArgs.name, args.name)
    assert.is(baileysProvider.globalVendorArgs.gifPlayback, args.gifPlayback)
    assert.is(baileysProvider.globalVendorArgs.usePairingCode, args.usePairingCode)
    assert.is(baileysProvider.globalVendorArgs.phoneNumber, args.phoneNumber)
    assert.is(baileysProvider.globalVendorArgs.useBaileysStore, args.useBaileysStore)
})

test.after(() => {})

test.run()
