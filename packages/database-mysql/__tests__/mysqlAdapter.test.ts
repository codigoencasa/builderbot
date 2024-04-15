import mysql2 from 'mysql2'
import { spy, stub } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { MysqlAdapter } from '../src/'

const mockCredentials: any = {
    host: 'localhost',
    user: 'test',
    database: 'test',
    password: 'test3',
}
const phone = '12335'

const mockHistoryRow = {
    phone,
    id: 1,
    ref: 'testRef',
    keyword: 'testKeyword',
    answer: 'testAnswer',
    refSerialize: 'testRefSerialize',
    options: '{"key": "value"}',
    created_at: '2022-01-11T00:00:00Z',
}

const mockConnection = {
    connect: async (callback) => {
        await callback(null)
    },
    query: (sql, callback) => {
        callback(null, [])
    },
}

const messageError = 'Error!'

class MockMysqlAdapter extends MysqlAdapter {
    queryResult: any
    db: any
    constructor(credentials) {
        super(credentials)
        this.db = mockConnection
        this.init().then()
    }

    mockQueryResult(result) {
        this.queryResult = result
    }

    async init(): Promise<void> {}

    insert() {
        this.db = {
            query: (_sql: string, values: any[], callback: (err: any) => void) => {
                callback(null)
            },
        }
    }

    error(message: string) {
        this.db = {
            query: (_sql: string, callback: (err: any) => void) => {
                callback(new Error(message))
            },
        }
    }

    errorInsert(message: string) {
        this.db = {
            query: (_sql: string, values: any[], callback: (err: any) => void) => {
                callback(new Error(message))
            },
        }
    }
}

const mockMysqlAdapter = new MockMysqlAdapter(mockCredentials)

const createTableSpy = spy(mockMysqlAdapter, 'createTable')
const checkTableExistsSpy = spy(mockMysqlAdapter, 'checkTableExists')

test.after.each(() => {
    createTableSpy.resetHistory()
    checkTableExistsSpy.resetHistory()
})

test('init - You should connect to the database', async () => {
    const createConnectionStub = stub(mysql2 as any, 'createConnection').returns({
        connect: stub().resolves(null),
        query: stub().callsFake(() => null),
    })
    const databaseManager = new MysqlAdapter(mockCredentials)
    databaseManager.db.connect = stub().callsFake((callback) => callback(null))
    const consoleLogSpy = spy(console, 'log')
    const checkTableExistsSutb = stub().resolves()
    databaseManager.checkTableExists = checkTableExistsSutb
    await databaseManager.init()
    assert.equal(createConnectionStub.called, true)
    assert.equal(consoleLogSpy.called, true)
    assert.equal(checkTableExistsSutb.called, true)
    assert.equal(consoleLogSpy.args[0][0], 'Successful database connection request')
    consoleLogSpy.restore()
})

test('[MysqlAdapter] - instantiation', () => {
    assert.instance(mockMysqlAdapter, MockMysqlAdapter)
    assert.equal(mockMysqlAdapter.credentials, mockCredentials)
})

test('[MysqlAdapter] - init', async () => {
    assert.equal(mockMysqlAdapter.db, mockConnection)
})

test('[MysqlAdapter] - createTable ', async () => {
    const result = await mockMysqlAdapter.createTable()
    assert.equal(result, true)
})

test('[MysqlAdapter] - createTable error ', async () => {
    try {
        mockMysqlAdapter.error(messageError)
        await mockMysqlAdapter.createTable()
    } catch (error) {
        assert.equal(error.message, messageError)
    }
})

test('[MysqlAdapter] - save ', async () => {
    const ctx = {
        ref: 'example_ref',
        keyword: 'example_keyword',
        answer: 'example_answer',
        refSerialize: 'example_ref_serialize',
        from: 'example_from',
        options: { example_option: 'value' },
    }
    try {
        mockMysqlAdapter.insert()
        await mockMysqlAdapter.save(ctx)
        assert.ok(true)
    } catch (error) {
        assert.unreachable('No debería lanzar un error')
    }
})

test('[MysqlAdapter] - save error ', async () => {
    try {
        mockMysqlAdapter.errorInsert(messageError)
        const ctx = {
            ref: 'example_ref',
            keyword: 'example_keyword',
            answer: 'example_answer',
            refSerialize: 'example_ref_serialize',
            from: 'example_from',
            options: { example_option: 'value' },
        }
        await mockMysqlAdapter.save(ctx)
    } catch (error) {
        assert.equal(error.message, messageError)
    }
})

test('[MysqlAdapter] - getPrevByNumber ', async () => {
    const mockQueryResult = [mockHistoryRow]

    mockMysqlAdapter.db.query = (sql: string, callback: Function) => {
        if (sql.startsWith('SELECT')) {
            callback({}, mockQueryResult)
        }
    }

    const result = await mockMysqlAdapter.getPrevByNumber(phone)
    assert.equal(result, mockHistoryRow)
})

test('[MysqlAdapter] - getPrevByNumber - null ', async () => {
    const phone = '33333'

    const mockQueryResult = []

    mockMysqlAdapter.db.query = (sql: string, callback: Function) => {
        if (sql.startsWith('SELECT')) {
            callback(null, mockQueryResult)
        }
    }

    const result = await mockMysqlAdapter.getPrevByNumber(phone)
    assert.equal(result, null)
})

test('[MysqlAdapter] - getPrevByNumber - error ', async () => {
    try {
        mockMysqlAdapter.error(messageError)
        await mockMysqlAdapter.getPrevByNumber(phone)
    } catch (error) {
        assert.equal(error.message, messageError)
    }
})

test('checkTableExists - should return true if table exists', async () => {
    mockMysqlAdapter.db = {
        query: (__, callback: Function) => {
            callback(null, [{ table: 'history' }])
        },
    }
    const result = await mockMysqlAdapter.checkTableExists()
    console.log(result)
    assert.is(result, true)
    assert.is(createTableSpy.notCalled, true)
})

test('You must call the createTable method if the table does not exist', async () => {
    mockMysqlAdapter.db = {
        query: (__, callback: Function) => {
            callback(null, [])
        },
    }
    const result = await mockMysqlAdapter.checkTableExists()
    assert.is(result, false)
})

test('should throw error when query fails', async () => {
    mockMysqlAdapter.db = {
        query: (__, callback: Function) => {
            callback(new Error('Error executing SQL query'))
        },
    }

    try {
        await mockMysqlAdapter.checkTableExists()
        assert.unreachable('Expected an error but none was thrown')
    } catch (error) {
        assert.instance(error, Error)
        assert.is(error.message, 'Error executing SQL query')
    }
})

test('should initialize successfully and check table existence', async () => {
    const mysqlAdapter = new MockMysqlAdapter(mockCredentials)
    mysqlAdapter.db = {
        connect: (callback: Function) => {
            callback(null)
        },
    }

    await mysqlAdapter.init()
    assert.is(checkTableExistsSpy.call.length, 1)
})

test.run()
