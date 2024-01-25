import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { MongoAdapter } from '../src/index'

const credentials = {
    dbUri: 'mongodb://localhost:27017',
    dbName: 'test',
}

test.skip('[MongoAdapter] - instantiation', () => {
    const mongoAdapter = new MongoAdapter(credentials)

    assert.instance(mongoAdapter, MongoAdapter)
})

test.skip('[MongoAdapter] - init', async () => {
    const mongoAdapter = new MongoAdapter(credentials)

    const initialized = await mongoAdapter.init()
    assert.ok(initialized, 'Initialization should be successful')
    assert.ok(mongoAdapter.db, 'Database connection should be established')
})

test.skip('[MongoAdapter] - save', async () => {
    const mongoAdapter = new MongoAdapter(credentials)

    const ctx = {
        from: '12345',
        body: 'Hello Word!',
        keyword: ['greeting'],
    }
    await mongoAdapter.save(ctx)
    assert.equal(mongoAdapter.listHistory.length, 1)
})

test.skip('[MongoAdapter] - getPrevByNumber', async () => {
    const mongoAdapter = new MongoAdapter(credentials)

    const from = '12345'
    const prevDocument = await mongoAdapter.getPrevByNumber(from)
    assert.ok(prevDocument)
    assert.equal(prevDocument.from, from)
})

test.run()
