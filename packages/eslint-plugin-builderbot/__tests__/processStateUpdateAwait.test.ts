import sinon from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { processStateUpdateAwait } from '../src/rules'

test('processStateUpdateAwait should not report if "state.update" is not accessed', () => {
    const mockContext: any = {
        getSourceCode: sinon.stub().returns({
            getText: sinon.stub().returns('await someOtherObject.someOtherMethod'),
        }),
        report: sinon.spy(),
    }
    const mockNode: any = {
        type: 'MemberExpression',
        object: {
            name: 'someOtherObject',
        },
        parent: {
            type: 'AwaitExpression',
        },
        range: [10, 20],
        callee: {
            property: {
                name: 'addAnswer',
            },
        },
    }

    processStateUpdateAwait(mockContext)['MemberExpression[property.name="update"]'](mockNode)

    assert.is(mockContext.report.notCalled, true)
})

test('processStateUpdateAwait should not report if "state.update" is not accessed', () => {
    const mockContext: any = {
        getSourceCode: sinon.stub().returns({
            getText: sinon.stub().returns('await '),
        }),
        report: sinon.spy(),
    }
    const mockNode: any = {
        type: 'MemberExpression',
        object: {
            name: 'state',
        },
        parent: {
            type: 'AwaitExpression',
        },
        range: [6, 10],
        callee: {
            property: {
                name: 'addAnswer',
            },
        },
    }

    processStateUpdateAwait(mockContext)['MemberExpression[property.name="update"]'](mockNode)

    assert.is(mockContext.report.notCalled, true)
})

test('processStateUpdateAwait should not report if "state.update" is not accessed', () => {
    const mockContext: any = {
        getSourceCode: sinon.stub().returns({
            getText: sinon.stub().returns('await '),
        }),
        report: sinon.spy(),
    }
    const mockNode: any = {
        type: 'MemberExpression',
        object: {
            name: 'state',
        },
        parent: {
            type: 'AwaitExpression',
        },
        range: [0, 10],
        callee: {
            property: {
                name: 'other',
            },
        },
    }

    processStateUpdateAwait(mockContext)['MemberExpression[property.name="update"]'](mockNode)

    assert.is(mockContext.report.notCalled, true)
})

test('processStateUpdateAwait should not report if "state.update" is not accessed', () => {
    const insertTextBeforeStub = sinon.stub()
    const reportStub = sinon.stub().callsFake((options: any) => {
        const fixer = {
            insertTextBefore: insertTextBeforeStub,
        }
        options.fix(fixer)
    })
    const mockContext: any = {
        getSourceCode: sinon.stub().returns({
            getText: sinon.stub().returns('await someOtherObject.someOtherMethod'),
        }),
        report: reportStub,
    }
    const mockNode: any = {
        type: 'CallExpression',
        object: {
            name: 'state',
        },
        parent: {
            type: 'OtherExpression',
        },
        range: [10, 20],
        callee: {
            property: {
                name: 'addAnswer',
            },
        },
    }

    processStateUpdateAwait(mockContext)['MemberExpression[property.name="update"]'](mockNode)

    assert.equal(mockContext.report.called, true)
    assert.equal(reportStub.called, true)
})

test.run()
