/**
 * LAYER: Interface
 * Contains: Dynamic flow keyword validation regressions
 * Rules: Check public HTTP and registry contracts without external services.
 * BigO: O(n) score:3
 * keywords: [FlowRegistry, BotManagerApi, KeywordValidation]
 * GOAL: Reject invalid patterns before they can replace a working dynamic flow.
 */
import { once } from 'events'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { BotManagerApi } from '../src/api'
import { BotManager } from '../src/bot-manager'
import { FlowRegistry } from '../src/flow-registry'

const validFlow = { id: 'safe', name: 'Safe', keyword: '^hello$', steps: [{ answer: 'Hello' }] }

test('registry rejects invalid create and update without changing stored flows', () => {
    const registry = new FlowRegistry()
    const original = registry.registerDynamic(validFlow)
    assert.throws(() => registry.registerDynamic({ ...validFlow, id: 'bad', keyword: '(' }))
    assert.is(registry.count(), 1)
    assert.is(registry.has('bad'), false)
    assert.throws(() => registry.update('safe', { keyword: ['hello', '('], name: 'Changed' }))
    assert.is(registry.get('safe'), original)
    const updated = registry.update('safe', { keyword: ['^hello$', 'hi'] })
    assert.equal(updated?.config?.keyword, ['^hello$', 'hi'])
})

test('HTTP rejects invalid keywords with 400 and preserves registry contents', async () => {
    const api = new BotManagerApi(new BotManager(), { port: 0, apiKey: 'keyword-test-key', rateLimit: false })
    api.start()
    // Read the ephemeral listening address only; all contract assertions use HTTP.
    const server = (api as any).app.server
    if (!server.listening) await once(server, 'listening')
    const url = `http://127.0.0.1:${server.address().port}/api/flows`
    const headers = { 'Content-Type': 'application/json', 'X-API-Key': 'keyword-test-key' }
    const request = (path: string, method: string, body?: unknown) =>
        fetch(`${url}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    try {
        const created = await request('', 'POST', validFlow)
        assert.is(created.status, 201)
        const before = await (await request('', 'GET')).json()
        const rejectedCreate = await request('', 'POST', { ...validFlow, id: 'bad', keyword: '(' })
        assert.is(rejectedCreate.status, 400)
        assert.equal(await rejectedCreate.json(), {
            error: 'Validation failed',
            details: [{ field: 'keyword', message: 'keyword must be a valid regular expression' }],
        })
        const rejectedUpdate = await request('/safe', 'PUT', { keyword: ['hello', '('], name: 'Changed' })
        assert.is(rejectedUpdate.status, 400)
        assert.equal(await rejectedUpdate.json(), {
            error: 'Validation failed',
            details: [{ field: 'keyword', message: 'keyword must be a valid regular expression' }],
        })
        assert.equal(await (await request('', 'GET')).json(), before)
        const accepted = await request('/safe', 'PUT', { keyword: ['^hello$', 'hi'] })
        assert.is(accepted.status, 200)
        assert.equal((await accepted.json()).config.keyword, ['^hello$', 'hi'])
    } finally {
        const closed = once(server, 'close')
        api.stop()
        await closed
    }
})

test.run()
