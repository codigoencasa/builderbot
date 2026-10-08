import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { Queue } from '../../src/utils/queueClass'

// Silent logger
const mockLogger: Console = { log: () => {}, error: () => {} } as unknown as Console

/**
 * Regresión del auto-deadlock re-entrante.
 *
 * Clave de fidelidad: en el flujo real el callback del flujo se ejecuta DESPUÉS de
 * `await sendProviderAndSave(...)` (ver `enqueueMsg` en coreClass), es decir en una microtask
 * posterior a que `enqueue` haya marcado `workingOnPromise[from] = true`. Por eso la
 * re-entrada debe diferirse un tick; si se encola de forma síncrona el enqueue anidado ve
 * `workingOnPromise = false` y el deadlock no se reproduce.
 *
 * Antes del fix (processQueue con `splice` + `await Promise.all(batch)`), el item B encolado
 * en esa microtask quedaba huérfano y A lo awaitaba hasta el timeout:
 * "Queue item timeout after 300ms".
 */
test('Queue - re-entrant enqueue same from does not deadlock', async () => {
    const queue = new Queue<string>(mockLogger, 15, 300)
    const order: string[] = []

    const result = await queue.enqueue(
        'user1',
        async () => {
            order.push('A-start')
            // Simula `await sendProviderAndSave(...)` antes de ejecutar el callback del flujo
            await new Promise((r) => setTimeout(r, 1))
            // Simula sendFlow -> enqueueMsg desde dentro del callback
            await queue.enqueue(
                'user1',
                async () => {
                    order.push('B')
                },
                'ref-B'
            )
            order.push('A-end')
        },
        'ref-A'
    )

    assert.is(result, 'success')
    assert.equal(order, ['A-start', 'B', 'A-end'])
})

test('Queue - re-entrant depth 3 does not deadlock', async () => {
    const queue = new Queue<string>(mockLogger, 15, 500)
    const order: string[] = []

    const result = await queue.enqueue(
        'deep',
        async () => {
            order.push('A')
            await new Promise((r) => setTimeout(r, 1))
            await queue.enqueue(
                'deep',
                async () => {
                    order.push('B')
                    await new Promise((r) => setTimeout(r, 1))
                    await queue.enqueue(
                        'deep',
                        async () => {
                            order.push('C')
                        },
                        'ref-C'
                    )
                },
                'ref-B'
            )
        },
        'ref-A'
    )

    assert.is(result, 'success')
    assert.equal(order, ['A', 'B', 'C'])
})

test('Queue - re-entrant at concurrency limit does not deadlock', async () => {
    // N items en vuelo (N == límite) donde CADA uno awaita un hijo encolado.
    // Sin detección de re-entrada, ningún padre completa y ningún hijo arranca → deadlock.
    const limit = 5
    const queue = new Queue<string>(mockLogger, limit, 400)
    const from = 'saturated'
    const done: number[] = []

    const parents = Array.from({ length: limit }).map((_, i) =>
        queue.enqueue(
            from,
            async () => {
                await new Promise((r) => setTimeout(r, 1)) // simula sendProviderAndSave
                await queue.enqueue(
                    from,
                    async () => {
                        done.push(i)
                    },
                    `child-${i}`
                )
            },
            `parent-${i}`
        )
    )

    const results = await Promise.allSettled(parents)

    assert.is(results.filter((r) => r.status === 'rejected').length, 0, 'no parent should time out')
    assert.equal(
        done.sort((a, b) => a - b),
        Array.from({ length: limit }).map((_, i) => i)
    )
})

test('Queue - re-entrant enqueue does not block a different from', async () => {
    const queue = new Queue<string>(mockLogger, 15, 500)
    const order: string[] = []

    const parent = queue.enqueue(
        'u1',
        async () => {
            order.push('u1-parent-start')
            await new Promise((r) => setTimeout(r, 1))
            await queue.enqueue('u1', async () => order.push('u1-child'), 'u1-child')
            order.push('u1-parent-end')
        },
        'u1-parent'
    )

    const other = queue.enqueue('u2', async () => order.push('u2'), 'u2-task')

    await Promise.all([parent, other])

    assert.ok(order.includes('u2'), 'independent from should complete')
    assert.is(order[order.length - 1], 'u1-parent-end')
})

test.run()
