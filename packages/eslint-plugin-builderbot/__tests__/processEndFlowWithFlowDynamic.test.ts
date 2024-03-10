import sinon from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { processEndFlowWithFlowDynamic } from '../src/rules'

test('processStateUpdateAwait should not report if "state.update" is not accessed', () => {
    const mockContext: any = {
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

    processEndFlowWithFlowDynamic(mockContext)['CallExpression[callee.name="endFlow"]'](mockNode)

    assert.is(mockContext.report.notCalled, true)
})

test('Debería llamar a context.report con el mensaje correcto si se detecta endFlow dentro del mismo contexto que flowDynamic', () => {
    const getAncestorsStub = sinon
        .stub()
        .returns([
            { type: 'BlockStatement', body: [{ expression: { argument: { callee: { name: 'flowDynamic' } } } }] },
        ])
    const reportStub = sinon.stub()

    const contextMock: any = {
        getAncestors: getAncestorsStub,
        report: reportStub,
    }

    const mockNode: any = {
        type: 'CallExpression',

        parent: {
            type: 'OtherExpression',
        },

        callee: {
            property: {
                name: 'addAnswer',
            },
        },
    }

    const processEndFlow = processEndFlowWithFlowDynamic(contextMock)
    processEndFlow['CallExpression[callee.name="endFlow"]'](mockNode)

    assert.ok(reportStub.called)
    assert.is(reportStub.firstCall.args[0].node, mockNode)
    assert.is(reportStub.firstCall.args[0].message, 'Do not use endFlow in the same execution context as flowDynamic.')
})

test.run()
