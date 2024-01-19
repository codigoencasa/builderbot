import { test } from 'uvu'
import * as sinon from 'sinon'
import * as assert from 'uvu/assert'
import { INode, Context } from '../src/types'
import { isInsideAddActionOrAddAnswer, processEndFlowReturn } from '../src/rules/processEndFlowReturn'

const createMockNode = (type: string, calleeName?: string): INode => ({
    type,
    callee: {
        property: {
            name: calleeName,
        },
    },
    parent: null as any,
})

test('isInsideAddActionOrAddAnswer - should return true if inside addAction or addAnswer', () => {
    const node = createMockNode('CallExpression', 'addAction')
    const result = isInsideAddActionOrAddAnswer(node)

    assert.is(result, true)
})

test('isInsideAddActionOrAddAnswer - should return false if not inside addAction or addAnswer', () => {
    const node = createMockNode('CallExpression', 'someOtherFunction')
    const result = isInsideAddActionOrAddAnswer(node)
    assert.is(result, false)
})

test('processEndFlowReturn - should report an error if endFlow is not inside a ReturnStatement', () => {
    const node = createMockNode('CallExpression', 'addAction')
    const parentNode = createMockNode('SomeOtherType')
    const context: Context = {
        report: sinon.fake(),
    }
    node.parent = parentNode

    processEndFlowReturn(context)['CallExpression[callee.name="endFlow"]'](node)
    sinon.assert.calledOnceWithExactly(context.report as sinon.SinonSpy, {
        node,
        message: 'Please ensure "endFlow" function is returned',
        fix: sinon.match.func,
    })
})

test('processEndFlowReturn - return', () => {
    const node = createMockNode('CallExpression', 'someOtherFunction')
    const parentNode = createMockNode('SomeOtherType')
    const context: Context = {
        report: sinon.fake(),
    }
    node.parent = parentNode

    processEndFlowReturn(context)['CallExpression[callee.name="endFlow"]'](node)
    sinon.assert.notCalled(context.report as sinon.SinonSpy)
})

test.run()
