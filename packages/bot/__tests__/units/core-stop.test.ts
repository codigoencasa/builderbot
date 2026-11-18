/**
 * LAYER: Application
 * Contains: Core runtime shutdown regressions
 * Rules: Exercise public core/provider events without network resources.
 * BigO: O(1) score:5
 * keywords: [CoreClass, ProviderLifecycle]
 * GOAL: Stop provider events from reaching a stopped bot without removing unrelated listeners.
 */
import { EventEmitter } from 'events'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { createBot, createFlow, MemoryDB } from '../../src'

test('stop unregisters core listeners and preserves unrelated provider listeners', async () => {
    const provider = new EventEmitter() as any
    let stops = 0
    provider.stop = async () => {
        stops++
    }
    const bot = await createBot({ flow: createFlow([]), provider, database: new MemoryDB() })
    let handled = 0
    let external = 0
    bot.handleMsg = async () => {
        handled++
    }
    provider.on('message', () => {
        external++
    })

    provider.emit('message', { from: 'sender', body: 'before' })
    assert.is(handled, 1)
    await bot.stop()
    provider.emit('message', { from: 'sender', body: 'after' })
    assert.is(handled, 1)
    assert.is(external, 2)
    assert.is(stops, 1)
    await bot.stop()
    provider.emit('message', { from: 'sender', body: 'after again' })
    assert.is(handled, 1)
    assert.is(external, 3)
})

test.run()
