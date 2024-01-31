import { MongoMemoryServer } from 'mongodb-memory-server'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { MongoAdapter } from '../src/index'

export const delay = (milliseconds: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

const hookClose = async () => {
    await delay(1000)
    process.exit(0)
}

let mongoServer: MongoMemoryServer
let mongoAdapter: MongoAdapter

test.before(async () => {
    mongoServer = await MongoMemoryServer.create()
    const uri = mongoServer.getUri()
    mongoAdapter = new MongoAdapter({
        dbUri: uri,
        dbName: 'testDB',
    })
})

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

test.after(async () => {
    await mongoServer.stop()
    hookClose().then()
})

test.run()
