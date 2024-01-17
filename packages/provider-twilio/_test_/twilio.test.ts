import { test } from 'uvu'
import * as assert from 'uvu/assert'
import sinon from 'sinon'
import proxyquire from 'proxyquire'
import twilio from 'twilio'
import { ProviderClass } from '@bot-whatsapp/bot'

// Mocks para las dependencias
const createStub = sinon.stub()
console.log('Before import')

// Inicializamos variables para usar en las pruebas

test.before.each(() => {})

test.skip('TwilioProvider: sendMessage sends a message without media', async () => {
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
    })
    createStub.resolves({ sid: 'fakeSid' })
    const provider = new TwilioProvider({
        accountSid: 'a',
        authToken: 'ACfakeToken',
        vendorNumber: '123456789',
        port: 3000,
        publicUrl: 'http://localhost',
    })
    const message = await provider.sendMessage('123456789', { message: 'Hello' })

    assert.ok(createStub.calledOnce)
    assert.equal(createStub.firstCall.args[0], {
        body: 'Hello',
        from: 'whatsapp:+123456789',
        to: 'whatsapp:+123456789',
    })
})

// Aquí puedes agregar más pruebas para los otros métodos y casos de uso

test.run()
