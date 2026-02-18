import { MongoMemoryServer } from 'mongodb-memory-server'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { MongoAdapter } from '../src/index'

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

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
        dbName: 'testEdgeCases',
    })
    await mongoAdapter.init()
})

// ===== Concurrent saves =====

test('[MongoAdapter] - concurrent saves should not lose data', async () => {
    const initialLen = mongoAdapter.listHistory.length
    const promises = []
    for (let i = 0; i < 10; i++) {
        promises.push(
            mongoAdapter.save({
                from: 'concurrent_user',
                body: `Message ${i}`,
                keyword: ['test'],
            })
        )
    }
    await Promise.all(promises)
    assert.equal(mongoAdapter.listHistory.length, initialLen + 10)
})

test('[MongoAdapter] - concurrent saves getPrevByNumber returns latest', async () => {
    const lastDoc = await mongoAdapter.getPrevByNumber('concurrent_user')
    assert.ok(lastDoc, 'Should find the latest concurrent save')
    assert.equal(lastDoc.from, 'concurrent_user')
})

// ===== Edge case: special characters =====

test('[MongoAdapter] - save with special characters in body', async () => {
    const ctx = {
        from: 'special_char_user',
        body: 'Hello 🚀 "quotes" <tags> & ampersand',
        keyword: ['special'],
    }
    await mongoAdapter.save(ctx)
    const prev = await mongoAdapter.getPrevByNumber('special_char_user')
    assert.equal(prev.body, ctx.body, 'Special characters should be preserved')
})

test('[MongoAdapter] - save with unicode phone numbers', async () => {
    const ctx = {
        from: '+5491155551234',
        body: 'Hola mundo',
        keyword: ['intl'],
    }
    await mongoAdapter.save(ctx)
    const prev = await mongoAdapter.getPrevByNumber('+5491155551234')
    assert.ok(prev, 'Should find by international phone format')
})

// ===== Edge case: empty and null fields =====

test('[MongoAdapter] - save with empty body', async () => {
    const ctx = {
        from: 'empty_body_user',
        body: '',
        keyword: [],
    }
    await mongoAdapter.save(ctx)
    const prev = await mongoAdapter.getPrevByNumber('empty_body_user')
    assert.equal(prev.body, '')
})

test('[MongoAdapter] - save with null keyword', async () => {
    const ctx = {
        from: 'null_keyword_user',
        body: 'test',
        keyword: null,
    }
    await mongoAdapter.save(ctx)
    const prev = await mongoAdapter.getPrevByNumber('null_keyword_user')
    assert.equal(prev.keyword, null)
})

// ===== Edge case: very long data =====

test('[MongoAdapter] - save with very long body', async () => {
    const longBody = 'A'.repeat(10000)
    const ctx = {
        from: 'long_body_user',
        body: longBody,
        keyword: ['long'],
    }
    await mongoAdapter.save(ctx)
    const prev = await mongoAdapter.getPrevByNumber('long_body_user')
    assert.equal(prev.body.length, 10000)
})

// ===== Edge case: multiple messages from same user =====

test('[MongoAdapter] - getPrevByNumber returns most recent entry', async () => {
    await mongoAdapter.save({ from: 'multi_user', body: 'First', keyword: ['a'] })
    await delay(50)
    await mongoAdapter.save({ from: 'multi_user', body: 'Second', keyword: ['b'] })
    await delay(50)
    await mongoAdapter.save({ from: 'multi_user', body: 'Third', keyword: ['c'] })

    const prev = await mongoAdapter.getPrevByNumber('multi_user')
    assert.equal(prev.body, 'Third', 'Should return the most recent message')
})

// ===== Edge case: object with extra fields =====

test('[MongoAdapter] - save preserves extra context fields', async () => {
    const ctx = {
        from: 'extra_fields_user',
        body: 'test',
        keyword: ['test'],
        ref: 'some_ref',
        refSerialize: 'some_serialize',
        options: { capture: true, delay: 100 },
    }
    await mongoAdapter.save(ctx)
    const prev = await mongoAdapter.getPrevByNumber('extra_fields_user')
    assert.equal(prev.ref, 'some_ref')
    assert.equal(prev.refSerialize, 'some_serialize')
    assert.ok(prev.options, 'Options should be preserved')
})

// ===== Edge case: date field validation =====

test('[MongoAdapter] - saved documents have valid Date objects', async () => {
    const before = new Date()
    await mongoAdapter.save({ from: 'date_test_user', body: 'test', keyword: ['dt'] })
    const after = new Date()

    const prev = await mongoAdapter.getPrevByNumber('date_test_user')
    assert.instance(prev.date, Date)

    const savedDate = new Date(prev.date)
    assert.ok(savedDate >= before, 'Date should be after test start')
    assert.ok(savedDate <= after, 'Date should be before test end')
})

// ===== Edge case: listHistory accumulation =====

test('[MongoAdapter] - listHistory should accumulate all saved items', () => {
    assert.ok(mongoAdapter.listHistory.length > 0, 'listHistory should have accumulated items')
})

test.after(async () => {
    await mongoServer.stop()
    hookClose().then()
})

test.run()
