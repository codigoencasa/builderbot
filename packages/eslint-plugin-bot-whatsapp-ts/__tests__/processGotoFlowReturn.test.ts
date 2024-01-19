import { test } from 'uvu'
import * as sinon from 'sinon'
import * as assert from 'uvu/assert'
import { INode, Context } from '../src/types'
import { processGotoFlowReturn, isInsideAddActionOrAddAnswer } from '../src/rules'

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
