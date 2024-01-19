import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { MongoAdapter } from '../src/index'

const credentials = {
    dbUri: 'mongodb://localhost:27017',
    dbName: 'test',
}

const mongoAdapter = new MongoAdapter(credentials)

test('[MongoAdapter] - instantiation', () => {
    assert.instance(mongoAdapter, MongoAdapter)
})

test('[MongoAdapter] - init', async () => {
    const initialized = await mongoAdapter.init()
    assert.ok(initialized, 'Initialization should be successful')
    assert.ok(mongoAdapter.db, 'Database connection should be established')
})

test('[MongoAdapter] - save', async () => {
    const ctx = {
        from: '12345',
        body: 'Hello Word!',
        keyword: ['greeting'],
    }
    await mongoAdapter.save(ctx)
    assert.equal(mongoAdapter.listHistory.length, 1)
})

test('[MongoAdapter] - getPrevByNumber', async () => {
    const from = '12345'
    const prevDocument = await mongoAdapter.getPrevByNumber(from)
    assert.ok(prevDocument)
    assert.equal(prevDocument.from, from)
})

test.run()
