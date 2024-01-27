import proxyquire from 'proxyquire'
import sinon from 'sinon'
import twilio from 'twilio'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

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
    console.log(provider)
    assert.ok(createStub.calledOnce)
    assert.equal(createStub.firstCall.args[0], {
        body: 'Hello',
        from: 'whatsapp:+123456789',
        to: 'whatsapp:+123456789',
    })
})

// test('server instance to extend meta endpoint with middleware', async () => {
//     stub(metaProvider, 'sendMessageMeta').resolves({})
//     metaProvider.http.server.get('/your-route-custom', (_, res) => {
//         res.end('Hello World')
//     })
//     const response = await axios(`http://localhost:3999/your-route-custom`)
//     assert.equal(response.status, 200)
//     assert.equal(response.data, 'Hello World')
// });
test.run()
