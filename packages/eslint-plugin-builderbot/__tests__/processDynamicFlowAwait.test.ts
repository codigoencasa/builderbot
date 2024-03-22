import * as sinon from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { processDynamicFlowAwait } from '../src/rules/processDynamicFlowAwait'
import type { Context, INode } from '../src/types'

const createMockNode = (type: string, calleeName?: string): INode => ({
    type,
    callee: {
        property: {
            name: calleeName,
        },
    } as any,
    parent: null as any,
})

test('processDynamicFlowAwait - should report an error if endFlow is not inside a ReturnStatement', () => {
    const node = createMockNode('CallExpression', 'addAction')
    const parentNode = createMockNode('SomeOtherType')
    const context: Context = {
        report: sinon.fake(),
    }
    node.parent = parentNode as any

    processDynamicFlowAwait(context)['CallExpression[callee.name="flowDynamic"]'](node)
    sinon.assert.calledOnceWithExactly(context.report as sinon.SinonSpy, {
        node,
        message: 'Please use "await" before "flowDynamic" function',
        fix: sinon.match.func,
    })
})

test('processDynamicFlowAwait - return', () => {
    const node = createMockNode('CallExpression', 'someOtherFunction')
    const parentNode = createMockNode('SomeOtherType')

    const context: Context = {
        report: sinon.fake(),
    }
    node.parent = parentNode as any

    processDynamicFlowAwait(context)['CallExpression[callee.name="flowDynamic"]'](node)
    sinon.assert.notCalled(context.report as sinon.SinonSpy)
})

test('processDynamicFlowAwait should not report if "state.update" is not accessed', () => {
    const insertTextBeforeStub = sinon.stub()
    const reportStub = sinon.stub().callsFake((options: any) => {
        const fixer = {
            insertTextBefore: insertTextBeforeStub,
        }
        options.fix(fixer)
    })
    const mockContext: any = {
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
        callee: {
            property: {
                name: 'addAnswer',
            },
        },
    }

    processDynamicFlowAwait(mockContext)['CallExpression[callee.name="flowDynamic"]'](mockNode)
    assert.equal(mockContext.report.called, true)
    assert.equal(reportStub.called, true)
})

test.run()
