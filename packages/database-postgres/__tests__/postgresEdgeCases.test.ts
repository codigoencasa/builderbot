import { Pool } from 'pg'
import { stub } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { PostgreSQLAdapter } from '../src/postgresAdapter'
import type { HistoryEntry } from '../src/types'

const credentials = { host: 'localhost', user: '', database: '', password: null, port: 5432 }

class MockPool {
    async connect(): Promise<any> {
        return Promise.resolve({
            async query() {
                return { rows: [] }
            },
        })
    }
}

test.before(() => {
    Pool.prototype.connect = async function () {
        return new MockPool().connect()
    }
})

const createAdapter = (queryHandler?: Function): PostgreSQLAdapter => {
    const adapter = new PostgreSQLAdapter(credentials)
    adapter['db'] = {
        query: queryHandler || (async () => ({ rows: [], rowCount: 0 })),
    }
    return adapter
}

// ===== Concurrent save operations =====

test('[PostgreSQL Edge] - concurrent saves should not throw', async () => {
    const queryCalls: any[] = []
    const adapter = createAdapter(async (...args: any[]) => {
        queryCalls.push(args)
        return { rows: [], rowCount: 1 }
    })

    const historyBase: HistoryEntry = {
        ref: 'ref',
        keyword: 'kw',
        answer: 'ans',
        refSerialize: 'ser',
        from: '12345',
        options: {},
    }

    const promises = Array.from({ length: 10 }, (_, i) =>
        adapter.save({ ...historyBase, ref: `ref_${i}` })
    )

    await Promise.all(promises)
    assert.equal(adapter.listHistory.length, 10, 'All 10 saves should be in listHistory')
})

// ===== getPrevByNumber with refserialize mapping =====

test('[PostgreSQL Edge] - getPrevByNumber should map refserialize to refSerialize', async () => {
    const adapter = createAdapter(async () => ({
        rows: [
            {
                ref: 'ref1',
                keyword: 'kw',
                answer: 'ans',
                refserialize: 'mapped_serialize',
                phone: '12345',
                options: {},
            },
        ],
    }))

    const result = await adapter.getPrevByNumber('12345')
    assert.equal(result?.refSerialize, 'mapped_serialize', 'refserialize should be mapped to refSerialize')
    assert.equal((result as any)?.refserialize, undefined, 'lowercase refserialize should be deleted')
})

test('[PostgreSQL Edge] - getPrevByNumber should handle null row gracefully', async () => {
    const adapter = createAdapter(async () => ({
        rows: [undefined],
    }))

    const result = await adapter.getPrevByNumber('12345')
    assert.equal(result, undefined)
})

// ===== saveContact edge cases =====

test('[PostgreSQL Edge] - saveContact with action "a" should merge values', async () => {
    let savedQuery: any = null
    const adapter = createAdapter(async (...args: any[]) => {
        savedQuery = args
        return { rows: [], rowCount: 1 }
    })

    const existingContact = {
        id: 1,
        phone: '12345',
        created_at: '',
        updated_in: '',
        last_interaction: '',
        values: { name: 'John', age: 30 },
    }

    adapter.getContact = stub().resolves(existingContact) as any

    await adapter.saveContact({
        from: '12345',
        action: 'a',
        values: { email: 'john@test.com' },
    })

    // The query values should contain merged JSON
    const jsonValues = savedQuery[1][1]
    const parsed = JSON.parse(jsonValues)
    assert.equal(parsed.name, 'John', 'Should preserve existing name')
    assert.equal(parsed.age, 30, 'Should preserve existing age')
    assert.equal(parsed.email, 'john@test.com', 'Should add new email')
})

test('[PostgreSQL Edge] - saveContact with action "B" should replace values', async () => {
    let savedQuery: any = null
    const adapter = createAdapter(async (...args: any[]) => {
        savedQuery = args
        return { rows: [], rowCount: 1 }
    })

    const existingContact = {
        id: 1,
        phone: '12345',
        created_at: '',
        updated_in: '',
        last_interaction: '',
        values: { name: 'John', age: 30 },
    }

    adapter.getContact = stub().resolves(existingContact) as any

    await adapter.saveContact({
        from: '12345',
        action: 'B',
        values: { email: 'new@test.com' },
    })

    const jsonValues = savedQuery[1][1]
    const parsed = JSON.parse(jsonValues)
    assert.not.ok(parsed.name, 'Should NOT preserve old name with action B')
    assert.equal(parsed.email, 'new@test.com', 'Should only have new values')
})

test('[PostgreSQL Edge] - saveContact without action defaults to "a" (append)', async () => {
    let savedQuery: any = null
    const adapter = createAdapter(async (...args: any[]) => {
        savedQuery = args
        return { rows: [], rowCount: 1 }
    })

    adapter.getContact = stub().resolves({
        values: { existing: true },
    }) as any

    await adapter.saveContact({
        from: '12345',
        values: { newField: 'value' },
    })

    const parsed = JSON.parse(savedQuery[1][1])
    assert.equal(parsed.existing, true, 'Should preserve existing values when no action specified')
    assert.equal(parsed.newField, 'value', 'Should add new field')
})

test('[PostgreSQL Edge] - saveContact with null values should default to empty object', async () => {
    let savedQuery: any = null
    const adapter = createAdapter(async (...args: any[]) => {
        savedQuery = args
        return { rows: [], rowCount: 1 }
    })

    adapter.getContact = stub().resolves(null) as any

    await adapter.saveContact({
        from: '12345',
        values: null,
    })

    const parsed = JSON.parse(savedQuery[1][1])
    assert.equal(JSON.stringify(parsed), '{}', 'Should default to empty object')
})

// ===== save with complex options =====

test('[PostgreSQL Edge] - save should handle nested options correctly', async () => {
    let savedArgs: any = null
    const adapter = createAdapter(async (...args: any[]) => {
        savedArgs = args
        return { rows: [], rowCount: 1 }
    })

    await adapter.save({
        ref: 'ref1',
        keyword: 'kw',
        answer: 'ans',
        refSerialize: 'ser',
        from: '12345',
        options: {
            capture: true,
            buttons: [{ body: 'yes' }, { body: 'no' }],
            nested: [{ refSerialize: 'child_ser' }],
            delay: 1000,
        },
    })

    const optionsStr = savedArgs[1][5]
    const parsed = JSON.parse(optionsStr)
    assert.equal(parsed.capture, true)
    assert.equal(parsed.buttons.length, 2)
    assert.equal(parsed.nested.length, 1)
    assert.equal(parsed.delay, 1000)
})

// ===== Error propagation =====

test('[PostgreSQL Edge] - save error should propagate and not add to listHistory', async () => {
    const adapter = createAdapter(async () => {
        throw new Error('INSERT failed')
    })

    try {
        await adapter.save({
            ref: 'ref1',
            keyword: 'kw',
            answer: 'ans',
            refSerialize: 'ser',
            from: '12345',
            options: {},
        })
        assert.unreachable('Should have thrown')
    } catch (error) {
        assert.equal(error.message, 'INSERT failed')
        assert.equal(adapter.listHistory.length, 0, 'listHistory should not be modified on error')
    }
})

// ===== checkTableExistsAndSP =====

test('[PostgreSQL Edge] - checkTableExistsAndSP should run all queries in sequence', async () => {
    const queryCount = { value: 0 }
    const adapter = createAdapter(async () => {
        queryCount.value++
        return { rows: [], rowCount: 1 }
    })

    await adapter.checkTableExistsAndSP()
    // 2 CREATE TABLE + 2 CREATE FUNCTION = 4 queries minimum
    assert.ok(queryCount.value >= 4, `Should run at least 4 queries, got ${queryCount.value}`)
})

// ===== Credentials =====

test('[PostgreSQL Edge] - should store default credentials', () => {
    const adapter = new PostgreSQLAdapter(credentials)
    assert.equal(adapter.credentials.host, 'localhost')
    assert.equal(adapter.credentials.port, 5432)
})

test('[PostgreSQL Edge] - listHistory should start empty', () => {
    const adapter = new PostgreSQLAdapter(credentials)
    assert.equal(adapter.listHistory.length, 0)
})

test.run()
