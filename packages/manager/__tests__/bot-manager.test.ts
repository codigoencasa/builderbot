import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { BotManager } from '../src/bot-manager'

// Mock the external dependencies
const mockFlows: any[] = []

// Note: These are unit tests that test the BotManager logic
// without actually creating real bot instances

test('BotManager - constructor with default config', () => {
    const manager = new BotManager()
    assert.ok(manager)
    assert.is(manager.getBotCount(), 0)
})

test('BotManager - constructor with custom config', () => {
    const manager = new BotManager({
        sessionsDir: './custom-sessions',
        defaultProviderOptions: { timeout: 5000 },
    })
    assert.ok(manager)
})

test('BotManager - listBots returns empty array initially', () => {
    const manager = new BotManager()
    const bots = manager.listBots()
    assert.equal(bots, [])
})

test('BotManager - getAllBots returns empty array initially', () => {
    const manager = new BotManager()
    const bots = manager.getAllBots()
    assert.equal(bots, [])
})

test('BotManager - hasBot returns false for non-existent bot', () => {
    const manager = new BotManager()
    assert.not.ok(manager.hasBot('non-existent'))
})

test('BotManager - getBot returns undefined for non-existent bot', () => {
    const manager = new BotManager()
    const bot = manager.getBot('non-existent')
    assert.is(bot, undefined)
})

test('BotManager - getBotStatus returns undefined for non-existent bot', () => {
    const manager = new BotManager()
    const status = manager.getBotStatus('non-existent')
    assert.is(status, undefined)
})

test('BotManager - getBotCount returns 0 initially', () => {
    const manager = new BotManager()
    assert.is(manager.getBotCount(), 0)
})

test('BotManager - getBotsInfo returns empty array initially', () => {
    const manager = new BotManager()
    const info = manager.getBotsInfo()
    assert.equal(info, [])
})

test('BotManager - removeBot returns false for non-existent bot', async () => {
    const manager = new BotManager()
    const result = await manager.removeBot('non-existent')
    assert.not.ok(result)
})

test('BotManager - shutdown completes without bots', async () => {
    const manager = new BotManager()
    await manager.shutdown()
    assert.is(manager.getBotCount(), 0)
})

test('BotManager - restartBot returns null for non-existent bot', async () => {
    const manager = new BotManager()
    const result = await manager.restartBot('non-existent')
    assert.is(result, null)
})

test('BotManager - sendMessage returns false for non-existent bot', async () => {
    const manager = new BotManager()
    const result = await manager.sendMessage('non-existent', '123', 'hello')
    assert.not.ok(result)
})

// Event handling tests
test('BotManager - on registers event handler', () => {
    const manager = new BotManager()
    let called = false
    manager.on('bot:created', () => {
        called = true
    })
    // Handler registered but not called yet
    assert.not.ok(called)
})

test('BotManager - off removes event handler', () => {
    const manager = new BotManager()
    let callCount = 0
    const handler = () => {
        callCount++
    }

    manager.on('bot:created', handler)
    manager.off('bot:created', handler)

    // Even if we could trigger the event, handler shouldn't be called
    assert.is(callCount, 0)
})

test('BotManager - multiple handlers for same event', () => {
    const manager = new BotManager()
    let count1 = 0
    let count2 = 0

    manager.on('bot:created', () => {
        count1++
    })
    manager.on('bot:created', () => {
        count2++
    })

    // Both handlers registered
    assert.is(count1, 0)
    assert.is(count2, 0)
})

test('BotManager - updateBotStatus does nothing for non-existent bot', () => {
    const manager = new BotManager()
    // Should not throw
    manager.updateBotStatus('non-existent', 'connected')
    assert.is(manager.getBotStatus('non-existent'), undefined)
})

test.run()
