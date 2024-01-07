import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { Queue } from '../src/utils/queueClass'

// Mock Logger
const mockLogger: Console = {
    log: () => {},
    error: () => {},
} as unknown as Console

test.skip('Queue - enqueue and process', async () => {
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

    // Mock promise function
    const promiseFunc = () =>
        new Promise<string>((resolve) => {
            setTimeout(() => {
                completedTasks++
                resolve('completed')
            }, 10)
        })

    // Enqueue tasks more than the concurrency limit
    for (let i = 0; i < concurrencyLimit + 1; i++) {
        queue.enqueue('test', promiseFunc, i.toString())
    }

    // Wait for the queue to process
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Check if the number of completed tasks does not exceed the concurrency limit
    assert.is(completedTasks, concurrencyLimit)
})

test.skip('Queue - clearQueue', async () => {
    const queue = new Queue<string>(mockLogger)
    let result = ''

    // Mock promise function
    const promiseFunc = () =>
        new Promise<string>((resolve) => {
            setTimeout(() => resolve('completed'), 10)
        })

    // Enqueue a task
    queue.enqueue('test', promiseFunc, '1').then((res) => {
        result = res
    })

    // Clear the queue before the task completes
    await queue.clearQueue('test')

    // Check if the task was cleared
    assert.is(result, 'Queue cleared')
})

test.run()
