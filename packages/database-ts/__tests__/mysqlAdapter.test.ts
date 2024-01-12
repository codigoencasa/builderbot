import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { MysqlAdapter } from '../src/mysql'

const mockCredentials = {
    host: 'localhost',
    user: 'test',
    database: 'test',
    password: 'test3',
}

const mockConnection = {
    connect: async (callback) => {
        await callback(null)
    },
    query: (sql, callback) => {
        callback(null, [])
    },
}

class MockMysqlAdapter extends MysqlAdapter {
    queryResult: any
    db: any
    constructor(credentials) {
        super(credentials)
        this.db = mockConnection
    }

    mockQueryResult(result) {
        this.queryResult = result
    }

    // query(sql, callback) {
    //   callback(null, this.queryResult);
    // }

    async init(): Promise<void> {}

    checkTableExists = (): Promise<boolean> =>
        new Promise((resolve) => {
            resolve(!!this.queryResult.length)
        })
}

const mockMysqlAdapter = new MockMysqlAdapter(mockCredentials)

test('[MysqlAdapter] - instantiation', () => {
    assert.instance(mockMysqlAdapter, MockMysqlAdapter)
    assert.equal(mockMysqlAdapter.credentials, mockCredentials)
})

test('[MysqlAdapter] - init', async () => {
    assert.is(mockMysqlAdapter.db, mockConnection)
})

test('[MysqlAdapter] - checkTableExists ', async () => {
    mockMysqlAdapter.mockQueryResult([])
    const NoExists = await mockMysqlAdapter.checkTableExists()
    assert.is(NoExists, false)
    mockMysqlAdapter.mockQueryResult([{ Tables_in_database: 'history' }])
    const exists = await mockMysqlAdapter.checkTableExists()
    assert.is(exists, true)
})

test.run()
