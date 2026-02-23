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

    await stateManager.clearAll()

    const keys = await redisClient.keys('bot_state*')
    assert.is(keys.length, 0)
})

test.run()
