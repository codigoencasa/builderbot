/**
 * LAYER: Infrastructure
 * Contains: MySQL history lookup regression tests
 * Rules: Exercise the adapter with an isolated driver stub.
 * BigO: O(1) score:5
 * keywords: [MysqlAdapter, HistoryLookup]
 * GOAL: Keep sender data out of SQL and driver failures inside the returned promise.
 */
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { MysqlAdapter } from '../src'

class TestAdapter extends MysqlAdapter {
    async init(): Promise<void> {}
}

const adapter = () => new TestAdapter({ host: 'localhost', user: 'test', database: 'test', password: 'test' })

test('history lookup binds the complete sender as data', async () => {
    const db = adapter()
    const sender = "o'brien' OR '1'='1@example.com"
    let statement: string
    let parameters: unknown
    db.db = {
        query: (sql, values, callback) => {
            statement = sql
            parameters = typeof values === 'function' ? undefined : values
            ;(callback ?? values)(null, [])
        },
    } as any

    assert.equal(await db.getPrevByNumber(sender), {})
    assert.is(statement, 'SELECT * FROM history WHERE phone=? ORDER BY id DESC')
    assert.equal(parameters, [sender])
    assert.equal(db.listHistory, [])
})

test('asynchronous driver errors reject without a secondary callback exception', async () => {
    const db = adapter()
    const error = new Error('DB connection lost')
    let callbackError: unknown
    db.db = {
        query: (_sql, values, callback) => {
            queueMicrotask(() => {
                try {
                    ;(callback ?? values)(error)
                } catch (err) {
                    callbackError = err
                }
            })
        },
    } as any

    const result = await db.getPrevByNumber('12345').then(
        () => 'unexpected success',
        (err) => err
    )
    assert.is(result, error)
    assert.is(callbackError, undefined)
    assert.equal(db.listHistory, [])
})

test('history lookup preserves parsed options and empty-history behavior', async () => {
    const db = adapter()
    db.db = {
        query: (_sql, values, callback) => {
            ;(callback ?? values)(null, [{ phone: '12345', options: '{"capture":true}' }])
        },
    } as any
    assert.equal(await db.getPrevByNumber('12345'), { phone: '12345', options: { capture: true } })
})

test.run()
