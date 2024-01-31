import * as sinon from 'sinon'
import { test } from 'uvu'

import { processDynamicFlowAwait } from '../src/rules/processDynamicFlowAwait'
import { Context, INode } from '../src/types'

const createMockNode = (type: string, calleeName?: string): INode => ({
    type,
    callee: {
        property: {
            name: calleeName,
        },
    },
    parent: null as any,
})

test('processDynamicFlowAwait - should report an error if endFlow is not inside a ReturnStatement', () => {
    const node = createMockNode('CallExpression', 'addAction')
    const parentNode = createMockNode('SomeOtherType')
    const context: Context = {
        report: sinon.fake(),
    }
    node.parent = parentNode

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
    node.parent = parentNode

    processDynamicFlowAwait(context)['CallExpression[callee.name="flowDynamic"]'](node)
    sinon.assert.notCalled(context.report as sinon.SinonSpy)
})

test.run()
