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

test('[MongoAdapter] - init with invalid URI should handle error', async () => {
    const invalidAdapter = new MongoAdapter({
        dbUri: 'mongodb://invalid:27017',
        dbName: 'testDB',
    })
    // Wait a bit for the constructor's init to fail
    await delay(100)
    const result = await invalidAdapter.init()
    // Should return undefined on error (falsy)
    assert.not.ok(result, 'Init should return falsy on error')
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

test('[MongoAdapter] - save multiple documents', async () => {
    const initialLength = mongoAdapter.listHistory.length
    const ctx1 = {
        from: '67890',
        body: 'First message',
        keyword: ['test'],
    }
    const ctx2 = {
        from: '67890',
        body: 'Second message',
        keyword: ['test'],
    }
    await mongoAdapter.save(ctx1)
    await mongoAdapter.save(ctx2)
    assert.equal(mongoAdapter.listHistory.length, initialLength + 2)
})

test('[MongoAdapter] - getPrevByNumber', async () => {
    const from = '12345'
    const prevDocument = await mongoAdapter.getPrevByNumber(from)
    assert.ok(prevDocument)
    assert.equal(prevDocument.from, from)
})

test('[MongoAdapter] - getPrevByNumber returns latest document', async () => {
    const from = '67890'
    const prevDocument = await mongoAdapter.getPrevByNumber(from)
    assert.ok(prevDocument)
    assert.equal(prevDocument.from, from)
    assert.equal(prevDocument.body, 'Second message')
})

test('[MongoAdapter] - getPrevByNumber returns undefined for non-existent number', async () => {
    const from = 'nonexistent99999'
    const prevDocument = await mongoAdapter.getPrevByNumber(from)
    assert.not.ok(prevDocument, 'Should return undefined for non-existent number')
})

test('[MongoAdapter] - saved document should have date field', async () => {
    const from = '12345'
    const prevDocument = await mongoAdapter.getPrevByNumber(from)
    assert.ok(prevDocument.date, 'Document should have date field')
    assert.instance(prevDocument.date, Date)
})

test('[MongoAdapter] - credentials should be stored', () => {
    assert.ok(mongoAdapter.credentials.dbUri, 'dbUri should be stored')
    assert.equal(mongoAdapter.credentials.dbName, 'testDB', 'dbName should be stored')
})

test.after(async () => {
    await mongoServer.stop()
    hookClose().then()
})

test.run()
