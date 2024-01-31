import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { Queue } from '../../src/utils/queueClass'

// Mock Logger
const mockLogger: Console = {
    log: () => {},
    error: () => {},
} as unknown as Console

test('Queue - enqueue and process', async () => {
    const queue = new Queue<string>(mockLogger)
    let result = ''

    const promiseFunc = () =>
        new Promise<string>((resolve) => {
            setTimeout(() => resolve(''), 10)
        })

    queue.enqueue('test', promiseFunc, '1').then((res) => {
        result = res
    })

    await new Promise((resolve) => setTimeout(resolve, 50))

    assert.is(result, 'success')
})

test('Queue - concurrency limit', async () => {
    const concurrencyLimit = 2
    const queue = new Queue<string>(mockLogger, concurrencyLimit)
    let completedTasks = 0

    const promiseFunc = () =>
        new Promise<string>((resolve) => {
            setTimeout(() => {
                completedTasks++
                resolve('completed')
            }, 100)
        })

    queue.enqueue('test', promiseFunc, '1')
    queue.enqueue('test', promiseFunc, '2')
    queue.enqueue('test', promiseFunc, '3')
    queue.enqueue('test', promiseFunc, '4')
    queue.enqueue('test', promiseFunc, '5')

    await new Promise((resolve) => setTimeout(resolve, 210))
    assert.is(completedTasks, 1)
})
test('Queue - clearQueue', async () => {
    const queue = new Queue<string>(mockLogger)
    let result = ''

    const promiseFunc = () =>
        new Promise<string>((resolve) => {
            setTimeout(() => resolve('completed'), 10)
        })

    queue.enqueue('test', promiseFunc, '1').then((res) => {
        result = res
        console.log(result)
    })

    const n = await queue.clearQueue('test')

    assert.is(0, n)
})

test.run()
