import * as sinon from 'sinon'
import { test } from 'uvu'

import { processGotoFlowReturn } from '../src/rules'
import { INode, Context } from '../src/types'

const createMockNode = (type: string, calleeName?: string): INode => ({
    type,
    callee: {
        property: {
            name: calleeName,
        },
    },
    parent: null as any,
})

test('processGotoFlowReturn - should report an error if gotoFlow is not inside a ReturnStatement', () => {
    const node = createMockNode('CallExpression', 'addAction')
    const parentNode = createMockNode('SomeOtherType')
    const context: Context = {
        report: sinon.fake(),
    }
    node.parent = parentNode

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
    node.parent = parentNode

    processGotoFlowReturn(context)['CallExpression[callee.name="gotoFlow"]'](node)
    sinon.assert.notCalled(context.report as sinon.SinonSpy)
})

test.run()
