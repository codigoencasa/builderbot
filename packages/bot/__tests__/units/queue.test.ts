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
