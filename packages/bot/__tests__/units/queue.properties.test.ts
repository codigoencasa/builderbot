import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { Queue } from '../../src/utils/queueClass'

// Silent logger
const mockLogger: Console = { log: () => {}, error: () => {} } as unknown as Console

test('Queue - concurrency never exceeds limit', async () => {
    const limit = 5
    const queue = new Queue<string>(mockLogger, limit, 5000)
    let active = 0
    let maxActive = 0

    const total = 40
    const tasks = Array.from({ length: total }).map((_, i) =>
        queue.enqueue(
            'c',
            async () => {
                active++
                maxActive = Math.max(maxActive, active)
                await new Promise((r) => setTimeout(r, 5))
                active--
            },
            `ref-${i}`
        )
    )

    await Promise.all(tasks)

    assert.ok(maxActive <= limit, `maxActive ${maxActive} exceeded limit ${limit}`)
    assert.ok(maxActive > 1, 'expected some concurrency')
})

test('Queue - FIFO start order preserved', async () => {
    const queue = new Queue<string>(mockLogger, 5, 5000)
    const startOrder: number[] = []

    const total = 20
    const tasks = Array.from({ length: total }).map((_, i) =>
        queue.enqueue(
            'fifo',
            async () => {
                startOrder.push(i)
                await new Promise((r) => setTimeout(r, 2))
            },
            `ref-${i}`
        )
    )

    await Promise.all(tasks)

    assert.equal(
        startOrder,
        Array.from({ length: total }).map((_, i) => i)
    )
})

test('Queue - burst same from resolves all and clears callbacks', async () => {
    const queue = new Queue<string>(mockLogger, 15, 5000)
    const from = 'burst'
    const total = 100
    let done = 0

    const tasks = Array.from({ length: total }).map((_, i) =>
        queue.enqueue(
            from,
            async () => {
                done++
            },
            `ref-${i}`
        )
    )

    const results = await Promise.all(tasks)

    assert.is(done, total)
    assert.is(results.filter((r) => r === 'success').length, total)
})

test('Queue - clearQueue(from) does not cancel timers of another from', async () => {
    const queue = new Queue<string>(mockLogger, 1, 80)
    let bRejected = false

    // B: item que nunca resuelve → debe rechazar por timeout
    const bPromise = queue
        .enqueue('B', () => new Promise<string>(() => {}), 'b-ref')
        .catch(() => {
            bRejected = true
        })

    // Dar tiempo a que B arranque y registre su timer
    await new Promise((r) => setTimeout(r, 5))

    // A: item propio + clearQueue('A') no debe tocar el timer de B
    queue.enqueue('A', () => new Promise<string>(() => {}), 'a-ref').catch(() => {})
    await new Promise((r) => setTimeout(r, 5))
    await queue.clearQueue('A')

    await bPromise
    assert.ok(bRejected, 'B should still time out: clearQueue(A) must not clear B timers')
})

test('Queue - signal.cancelled flips on timeout', async () => {
    const queue = new Queue<string>(mockLogger, 1, 50)
    let cancelledAfter: boolean | null = null
    let markDone: () => void = () => {}
    const taskDone = new Promise<void>((r) => (markDone = r))

    // El enqueue rechaza a los 50ms (timeout); la tarea sigue viva hasta los 120ms.
    await queue
        .enqueue(
            'sig',
            async (signal) => {
                await new Promise((r) => setTimeout(r, 120))
                cancelledAfter = signal.cancelled
                markDone()
            },
            'sig-ref'
        )
        .catch(() => {})

    await taskDone
    assert.is(cancelledAfter, true, 'signal should be cancelled after timeout')
})

test('Queue - signal.cancelled stays false on normal completion', async () => {
    const queue = new Queue<string>(mockLogger, 1, 5000)
    let cancelledDuring: boolean | null = null

    await queue.enqueue(
        'sig2',
        async (signal) => {
            cancelledDuring = signal.cancelled
        },
        'sig2-ref'
    )

    assert.is(cancelledDuring, false, 'signal should not be cancelled on success')
})

test('Queue - per-item timeout overrides global timeout', async () => {
    const queue = new Queue<string>(mockLogger, 1, 5000)
    let err: any = null
    const start = Date.now()

    await queue.enqueue('t', () => new Promise<string>(() => {}), 'fast-ref', 40).catch((e) => (err = e))

    const elapsed = Date.now() - start
    assert.ok(err instanceof Error, 'should reject')
    assert.ok(String(err.message).includes('40ms'), 'should use the per-item timeout')
    assert.ok(elapsed < 1000, `should reject quickly, elapsed ${elapsed}`)
})

test('Queue - clearAll empties every from', async () => {
    const queue = new Queue<string>(mockLogger, 1, 5000)

    const pending = ['x', 'y'].map((from) =>
        queue.enqueue(from, () => new Promise<string>(() => {}), `${from}-ref`).catch(() => {})
    )
    // Dar tiempo a que arranquen y queden en vuelo
    await new Promise((r) => setTimeout(r, 5))

    await queue.clearAll()
    await pending

    assert.ok(true, 'clearAll should not throw')
})

test.run()
