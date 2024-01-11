import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { MockDatabase } from '../src/mock'

const mockDatabase = new MockDatabase()

test('[MockDatabase] - instantiation', () => {
    assert.instance(mockDatabase, MockDatabase)
})

test('[MockDatabase] - save', () => {
    const mockDatabase = new MockDatabase()
    const contextToSave = { from: 'user1', keyword: 'greeting' }

    mockDatabase.save(contextToSave)

    assert.equal(mockDatabase.listHistory.length, 1)
    assert.equal(mockDatabase.listHistory[0], contextToSave)
})

test('[MockDatabase] - getPrevByNumber', () => {
    const mockDatabase = new MockDatabase()

    const context1 = { from: 'user1', keyword: 'greeting' }
    const context2 = { from: 'user2', keyword: 'farewell' }

    mockDatabase.listHistory = [context1, context2]

    const result1 = mockDatabase.getPrevByNumber('user1')
    const result2 = mockDatabase.getPrevByNumber('user2')
    const result3 = mockDatabase.getPrevByNumber('user3')

    assert.equal(result1, context1)
    assert.equal(result2, context2)
    assert.equal(result3, undefined)
})

test.run()
