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
test.run()
