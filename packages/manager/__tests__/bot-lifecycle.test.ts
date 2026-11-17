/**
 * LAYER: Application
 * Contains: Bot manager lifecycle regressions
 * Rules: Exercise public manager methods with an isolated provider.
 * BigO: O(1) score:5
 * keywords: [BotManager, BotLifecycle]
 * GOAL: Ensure tenant removal stops the runtime before releasing its registry entry.
 */
import { EventEmitter } from 'events'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { BotManager } from '../src/bot-manager'

class LifecycleProvider extends EventEmitter {
    listening = false
    calls: string[] = []
    globalVendorArgs: any

    constructor(args: any) {
        super()
        this.globalVendorArgs = args
    }

    initAll() {
        this.listening = true
    }

    async stop() {
        this.calls.push('stop')
        this.listening = false
    }

    async disconnect() {
        this.calls.push('disconnect')
    }
}

const config = { tenantId: 'lifecycle', flows: [], port: 3456, providerClass: LifecycleProvider as any }

test('removeBot retains and stops the runtime before reporting removal', async () => {
    const manager = new BotManager({ autoReconnect: { enabled: false } })
    const instance = await manager.createBot(config)
    const provider = instance.provider as unknown as LifecycleProvider
    let removedWhileListening: boolean | undefined
    manager.on('bot:removed', () => {
        removedWhileListening = provider.listening
    })
    assert.ok(provider.listening)
    const removed = await manager.removeBot(config.tenantId)
    assert.ok(removed)
    assert.ok(instance.bot, 'the lifecycle owner must be retained')
    assert.equal(provider.calls, ['stop', 'disconnect'])
    assert.is(provider.listening, false)
    assert.is(removedWhileListening, false)
    assert.is(manager.getBotCount(), 0)
    assert.is(await manager.removeBot(config.tenantId), false)
})

test('shutdown stops every runtime and still performs provider cleanup after a stop error', async () => {
    const manager = new BotManager({ autoReconnect: { enabled: false } })
    const instance = await manager.createBot(config)
    const provider = instance.provider as unknown as LifecycleProvider
    assert.ok(instance.bot, 'the runtime must be available for shutdown')
    instance.bot.stop = async () => {
        provider.calls.push('stop-error')
        throw new Error('runtime shutdown failed')
    }
    await manager.shutdown()
    assert.equal(provider.calls, ['stop-error', 'disconnect'])
    assert.is(manager.getBotCount(), 0)
})

test.run()
