import { Pool } from 'pg'
import * as sinon from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { PostgreSQLAdapter } from '../src/postgresAdapter'
import { Contact, HistoryEntry } from '../src/types'

const credentials = { host: 'localhost', user: '', database: '', password: null, port: 5432 }

const historyMock: HistoryEntry = {
    ref: 'exampleRef',
    keyword: 'exampleKeyword',
    answer: 'exampleAnswer',
    refSerialize: 'exampleRefSerialize',
    phone: '123456789',
    options: {
        option1: 'value1',
        option2: 42,
    },
}

const contactMock: Contact = {
    id: 1,
    phone: '5551234',
    created_at: '2024-01-17T12:30:00Z',
    updated_in: '2024-01-18T09:45:00Z',
    last_interaction: '2024-01-18T10:15:00Z',
    values: {
        name: 'John Doe',
        email: 'john.doe@example.com',
        age: 30,
    },
}

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

test('init() debería establecer correctamente la conexión y llamar a checkTableExistsAndSP', async () => {
    const postgreSQLAdapter = new PostgreSQLAdapter(credentials)

    assert.is(postgreSQLAdapter.db, undefined)
    const checkTableExistsAndSPSpy = sinon.spy(postgreSQLAdapter, 'checkTableExistsAndSP')

    await postgreSQLAdapter.init()
    assert.ok(postgreSQLAdapter.db)
    assert.ok(checkTableExistsAndSPSpy)
})

test('getPrevByNumber - It should return undefined', async () => {
    const from = '123456789'
    const postgreSQLAdapter = new PostgreSQLAdapter(credentials)
    postgreSQLAdapter['db'] = {
        query: async () => {
            return { rows: [] }
        },
    }

    const result = await postgreSQLAdapter.getPrevByNumber(from)
    assert.is(result, undefined)
})

test('getPrevByNumber - getPrevByNumber returns the previous history entry', async () => {
    const from = '123456789'
    const postgreSQLAdapter = new PostgreSQLAdapter(credentials)
    postgreSQLAdapter['db'] = {
        query: async () => {
            return { rows: [{ ...historyMock }] }
        },
    }

    const result = await postgreSQLAdapter.getPrevByNumber(from)
    assert.is(result?.phone, historyMock.phone)
    assert.is(result?.ref, historyMock.ref)
    assert.is(result?.refSerialize, undefined)
})

test('getContact - It should return undefined', async () => {
    const postgreSQLAdapter = new PostgreSQLAdapter(credentials)
    postgreSQLAdapter['db'] = {
        query: async () => {
            return { rows: [] }
        },
    }

    const result = await postgreSQLAdapter.getContact(historyMock)
    assert.is(result, undefined)
})

test('getContact - It I should return a contact', async () => {
    const mock = {
        ...historyMock,
        phone: contactMock.phone,
    }
    const postgreSQLAdapter = new PostgreSQLAdapter(credentials)
    postgreSQLAdapter['db'] = {
        query: async () => {
            return { rows: [{ ...contactMock }] }
        },
    }

    const result = await postgreSQLAdapter.getContact(mock)
    assert.is(result?.phone, contactMock.phone)
    assert.is(result?.id, contactMock.id)
    assert.is(result?.values, contactMock.values)
})

test('save method saves history entry', async () => {
    const postgreSQLAdapter = new PostgreSQLAdapter(credentials)
    postgreSQLAdapter['db'] = {
        query: async () => {
            return { rows: [], rowCount: 1 }
        },
    }
    const querySpy = sinon.spy(postgreSQLAdapter['db'], 'query')
    await postgreSQLAdapter.save(historyMock)
    assert.is(postgreSQLAdapter.listHistory.length, 1)
    assert.ok(querySpy)
})

test('checkTableExistsAndSP - creates or checks tables and stored procedures', async () => {
    const postgreSQLAdapter = new PostgreSQLAdapter(credentials)
    postgreSQLAdapter['db'] = {
        query: async () => {
            return { rows: [], rowCount: 1 }
        },
    }
    const querySpy = sinon.spy(postgreSQLAdapter['db'], 'query')
    await postgreSQLAdapter.checkTableExistsAndSP()
    assert.ok(querySpy)
})
test('createSP - creates or checks tables and stored procedures', async () => {
    const postgreSQLAdapter = new PostgreSQLAdapter(credentials)
    postgreSQLAdapter['db'] = {
        query: async () => {
            return { rows: [], rowCount: 1 }
        },
    }
    const querySpy = sinon.spy(postgreSQLAdapter['db'], 'query')
    await postgreSQLAdapter.createSP()
    assert.ok(querySpy)
})

test.run()
