import RedisMock from 'ioredis-mock'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { RedisAdapter } from '../src/index'

// Mock de la instancia de Redis
const redisClient = new RedisMock()

// Helper para crear una instancia fresca del adaptador
const createAdapter = (opts = {}) => {
    const defaultOpts = { prefix: 'test', store_messages: 10, expire: 3600 }
    return new RedisAdapter(redisClient as any, { ...defaultOpts, ...opts })
}

test.before.each(async () => {
    await redisClient.flushall()
})

test('RedisAdapter - debe instanciarse correctamente', () => {
    const adapter = createAdapter()
    assert.instance(adapter, RedisAdapter)
})

test('RedisAdapter - debe guardar y recuperar el último mensaje (getPrevByNumber)', async () => {
    const adapter = createAdapter()
    const from = '573000000000'

    const historyItem = {
        from,
        body: 'Hola mundo',
        answer: 'Respuesta del bot',
        keyword: [],
    }

    await adapter.save(historyItem)

    const prev = await adapter.getPrevByNumber(from)

    assert.is(prev.from, from)
    assert.is(prev.body, 'Hola mundo')
    assert.ok(prev.date, 'Debe contener una fecha generada')
})

test('RedisAdapter - debe manejar el límite de mensajes (ltrim)', async () => {
    // Solo guardamos los últimos 2 mensajes
    const adapter = createAdapter({ store_messages: 2 })
    const from = '123'

    await adapter.save({ from, body: 'mensaje 1', keyword: [] })
    await adapter.save({ from, body: 'mensaje 2', keyword: [] })
    await adapter.save({ from, body: 'mensaje 3', keyword: [] })

    const key = `history:test:${from}`
    const totalInRedis = await redisClient.llen(key)
    const allMessages = await redisClient.lrange(key, 0, -1)

    assert.is(totalInRedis, 2, 'Solo debe haber 2 mensajes en Redis')
    assert.snapshot(JSON.parse(allMessages[0]).body, 'mensaje 2', 'El primer mensaje debe haber sido eliminado')
})

test('RedisAdapter - debe aplicar prefijo correctamente', async () => {
    const adapter = createAdapter({ prefix: 'custom_bot' })
    const from = '999'

    await adapter.save({ from, body: 'test prefijo', keyword: [] })

    const rawData = await redisClient.exists('history:custom_bot:999')
    assert.is(rawData, 1, 'La llave en Redis debe contener el prefijo')
})

test('RedisAdapter - debe retornar null si no hay historial', async () => {
    const adapter = createAdapter()
    const result = await adapter.getPrevByNumber('non_existent')
    assert.is(result, null)
})

test('RedisAdapter - debe aplicar expiración (TTL)', async () => {
    const adapter = createAdapter({ expire: 100 })
    const from = 'ttl_user'

    await adapter.save({ from, body: 'expírame', keyword: [] })

    const ttl = await redisClient.ttl(`history:test:${from}`)
    assert.ok(ttl > 0 && ttl <= 100)
})

test.run()
