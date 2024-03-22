import * as sinon from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { processGotoFlowReturn } from '../src/rules'
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

test('processGotoFlowReturn - should report an error if gotoFlow is not inside a ReturnStatement', () => {
    const node = createMockNode('CallExpression', 'addAction')
    const parentNode = createMockNode('SomeOtherType')
    const context: Context = {
        report: sinon.fake(),
    }
    node.parent = parentNode as any

    processGotoFlowReturn(context)['CallExpression[callee.name="gotoFlow"]'](node)
    sinon.assert.calledOnceWithExactly(context.report as sinon.SinonSpy, {
        node,
        message: 'Please ensure "gotoFlow" function is returned',
        fix: sinon.match.func,
    })
})

test('processGotoFlowReturn - return', () => {
    const node = createMockNode('CallExpression', 'someOtherFunction')
    const parentNode = createMockNode('SomeOtherType')
    const context: Context = {
        report: sinon.fake(),
    }
    node.parent = parentNode as any

    processGotoFlowReturn(context)['CallExpression[callee.name="gotoFlow"]'](node)
    sinon.assert.notCalled(context.report as sinon.SinonSpy)
})

test('processGotoFlowReturn should not report if "state.update" is not accessed', () => {
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

    processGotoFlowReturn(mockContext)['CallExpression[callee.name="gotoFlow"]'](mockNode)
    assert.equal(mockContext.report.called, true)
    assert.equal(reportStub.called, true)
})

test.run()
