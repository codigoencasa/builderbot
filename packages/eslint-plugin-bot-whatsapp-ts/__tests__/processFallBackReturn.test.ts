import { test } from 'uvu'
import * as sinon from 'sinon'
import * as assert from 'uvu/assert'
import { INode, Context } from '../src/types'
import { processFallBackReturn, isInsideAddActionOrAddAnswer } from '../src/rules'

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

test('processFallBackReturn - should report an error if fallBack is not inside a ReturnStatement', () => {
    const node = createMockNode('CallExpression', 'addAction')
    const parentNode = createMockNode('SomeOtherType')
    const context: Context = {
        report: sinon.fake(),
    }
    node.parent = parentNode

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
    node.parent = parentNode

    processFallBackReturn(context)['CallExpression[callee.name="fallBack"]'](node)
    sinon.assert.notCalled(context.report as sinon.SinonSpy)
})

test.run()
