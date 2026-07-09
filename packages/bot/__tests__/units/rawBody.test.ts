import type { AddressInfo } from 'node:net'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { TestProvider } from '../../src/provider/providerMock'

/**
 * Regression tests for `ProviderClass.buildHTTPServer()`'s raw-body capture.
 *
 * Downstream providers (e.g. `@builderbot/provider-meta`'s webhook HMAC
 * signature check) need `req.rawBody` to hold the *exact* bytes the sender
 * transmitted — not a `JSON.stringify(req.body)` re-serialization of the
 * already-parsed JSON, which is not guaranteed to be byte-identical to the
 * original payload (whitespace, key order, number/unicode formatting can all
 * differ). These tests prove `req.rawBody` matches the wire bytes exactly,
 * using a payload deliberately formatted so the two would diverge.
 */

const listen = (provider: TestProvider): Promise<number> =>
    new Promise((resolve) => {
        provider.server.listen(0, () => {
            const address = provider.server.server.address() as AddressInfo
            resolve(address.port)
        })
    })

const close = (provider: TestProvider): Promise<void> =>
    new Promise((resolve) => provider.server.server.close(() => resolve()))

test('buildHTTPServer captures the exact raw request body on req.rawBody', async () => {
    // Arrange
    const provider = new TestProvider()
    let captured: { rawBody?: string; body?: unknown } | undefined

    provider.server.post('/raw-body-probe', (req: any, res: any) => {
        captured = { rawBody: req.rawBody, body: req.body }
        res.end('ok')
    })
    const port = await listen(provider)

    // Deliberately formatted with extra whitespace and a non-ASCII value so
    // `JSON.stringify(JSON.parse(rawPayload)) !== rawPayload`.
    const rawPayload = '{"entry":  [ { "field": "messages", "note": "café" } ]}'

    // Act
    await fetch(`http://127.0.0.1:${port}/raw-body-probe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawPayload,
    })
    await close(provider)

    // Assert
    assert.ok(captured, 'the probe handler should have been invoked')
    assert.is(captured?.rawBody, rawPayload, 'rawBody must equal the exact bytes sent on the wire')
    assert.is.not(
        captured?.rawBody,
        JSON.stringify(captured?.body),
        're-serializing the parsed body must NOT equal the raw bytes — this is why the JSON.stringify fallback is unreliable'
    )
})

test('buildHTTPServer still parses req.body as JSON alongside the captured raw body', async () => {
    // Arrange
    const provider = new TestProvider()
    let captured: { rawBody?: string; body?: unknown } | undefined

    provider.server.post('/raw-body-probe-2', (req: any, res: any) => {
        captured = { rawBody: req.rawBody, body: req.body }
        res.end('ok')
    })
    const port = await listen(provider)
    const rawPayload = '{"hello":"world"}'

    // Act
    await fetch(`http://127.0.0.1:${port}/raw-body-probe-2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawPayload,
    })
    await close(provider)

    // Assert
    assert.equal(captured?.body, { hello: 'world' })
    assert.is(captured?.rawBody, rawPayload)
})

test.run()
