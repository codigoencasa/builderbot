import RedisMock from 'ioredis-mock'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { RedisState } from '../../src/context/redisStateClass'

const redisClient = new RedisMock()
const prefix = 'test-bot'
const stateManager = new RedisState(redisClient as any, { prefix })

test.before.each(async () => {
    await redisClient.flushall()
})

test('RedisState - debe instanciarse', () => {
    assert.instance(stateManager, RedisState)
})

test('RedisState - updateState debe hacer merge de valores', async () => {
    const ctx = { from: 'user_1' }
    const update = stateManager.updateState(ctx)
    const getMyState = stateManager.getMyState(ctx.from)

    await update({ name: 'Leifer' })
    let state = await getMyState()
    assert.equal(state, { name: 'Leifer' })

    await update({ age: 30 })
    state = await getMyState()
    assert.equal(state, { name: 'Leifer', age: 30 })
})

test('RedisState - get debe obtener propiedades anidadas (dot notation)', async () => {
    const ctx = { from: 'user_2' }
    const update = stateManager.updateState(ctx)
    const getProp = stateManager.get(ctx.from)

    await update({
        profile: {
            skills: ['js', 'ts'],
            meta: { id: 100 },
        },
    })

    assert.equal(await getProp('profile.skills'), ['js', 'ts'])
    assert.is(await getProp('profile.meta.id'), 100)
    assert.is(await getProp('profile.nonexistent'), undefined)
})

test('RedisState - clear debe borrar solo el estado del usuario', async () => {
    const userA = { from: 'A' }
    const userB = { from: 'B' }

    await stateManager.updateState(userA)({ data: 'A' })
    await stateManager.updateState(userB)({ data: 'B' })

    const clearA = stateManager.clear(userA.from)
    await clearA()

    assert.is(await stateManager.getMyState(userA.from)(), undefined)
    assert.not.equal(await stateManager.getMyState(userB.from)(), undefined)
})

test('RedisState - clearAll debe limpiar todas las llaves del bot', async () => {
    await stateManager.updateState({ from: 'user1' })({ v: 1 })
    await stateManager.updateState({ from: 'user2' })({ v: 2 })
    assert.is((await redisClient.keys(`bot:state:${prefix}:*`)).length, 2)

    await stateManager.clearAll()

    const keys = await redisClient.keys(`bot:state:${prefix}:*`)
    assert.is(keys.length, 0)
})

test('RedisState - clearAll solo borra las llaves de su prefijo', async () => {
    const otherBot = new RedisState(redisClient as any, { prefix: 'other-bot' })

    await stateManager.updateState({ from: 'user1' })({ v: 1 })
    await otherBot.updateState({ from: 'user1' })({ v: 2 })
    await redisClient.set('bot:history:test-bot:user1', 'x')

    await stateManager.clearAll()

    assert.is(await stateManager.getMyState('user1')(), undefined)
    assert.equal(await otherBot.getMyState('user1')(), { v: 2 })
    assert.is(await redisClient.get('bot:history:test-bot:user1'), 'x')
})

test('RedisState - clearAll recorre varias páginas de SCAN', async () => {
    for (let i = 0; i < 250; i++) await stateManager.updateState({ from: `u${i}` })({ i })

    await stateManager.clearAll()

    assert.is((await redisClient.keys(`bot:state:${prefix}:*`)).length, 0)
})

test('RedisState - TTL por defecto es 24h', async () => {
    await stateManager.updateState({ from: 'ttl1' })({ v: 1 })
    const ttl = await redisClient.ttl(`bot:state:${prefix}:ttl1`)
    assert.ok(ttl > 60 * 60 * 23 && ttl <= 60 * 60 * 24)
})

test('RedisState - TTL configurable con expire', async () => {
    const custom = new RedisState(redisClient as any, { prefix, expire: 120 })
    await custom.updateState({ from: 'ttl2' })({ v: 1 })
    const ttl = await redisClient.ttl(`bot:state:${prefix}:ttl2`)
    assert.ok(ttl > 0 && ttl <= 120)
})

test('RedisState - expire null desactiva la expiración', async () => {
    const noTtl = new RedisState(redisClient as any, { prefix, expire: null })
    await noTtl.updateState({ from: 'ttl3' })({ v: 1 })
    assert.is(await redisClient.ttl(`bot:state:${prefix}:ttl3`), -1)
})

test.run()
