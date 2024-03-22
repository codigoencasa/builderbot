import * as sinon from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { processFallBackReturn } from '../src/rules'
import type { INode, Context } from '../src/types'

const createMockNode = (type: string, calleeName?: string): INode => ({
    type,
    callee: {
        property: {
            name: calleeName,
        },
    } as any,
    parent: null as any,
})

test('processFallBackReturn - should report an error if fallBack is not inside a ReturnStatement', () => {
    const node = createMockNode('CallExpression', 'addAction')
    const parentNode = createMockNode('SomeOtherType')
    const context: Context = {
        report: sinon.fake(),
    }
    node.parent = parentNode as any

    processFallBackReturn(context)['CallExpression[callee.name="fallBack"]'](node)
    sinon.assert.calledOnceWithExactly(context.report as sinon.SinonSpy, {
        node,
        message: 'Please ensure "fallBack" function is returned',
        fix: sinon.match.func,
    })
})

test('processFallBackReturn - return', () => {
    const node = createMockNode('CallExpression', 'someOtherFunction')
    const parentNode = createMockNode('SomeOtherType')
    const context: Context = {
        report: sinon.fake(),
    }
    node.parent = parentNode as any

    processFallBackReturn(context)['CallExpression[callee.name="fallBack"]'](node)
    sinon.assert.notCalled(context.report as sinon.SinonSpy)
})

test('processFallBackReturn should not report if "state.update" is not accessed', () => {
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

    processFallBackReturn(mockContext)['CallExpression[callee.name="fallBack"]'](mockNode)
    assert.equal(mockContext.report.called, true)
    assert.equal(reportStub.called, true)
})

test.run()
