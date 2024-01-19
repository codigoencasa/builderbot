import { test } from 'uvu'
import * as assert from 'uvu/assert'
import sinon from 'sinon'
import { isInsideAddActionOrAddAnswer, processDynamicFlowAwait } from '../src/rules/processDynamicFlowAwait'
import { INode } from '../src/types'

test('isInsideAddActionOrAddAnswer should correctly identify CallExpressions', () => {
    const node1: INode = {
        type: 'CallExpression',
        callee: { property: { name: 'addAction' } },
    }

    const node2: INode = {
        type: 'CallExpression',
        callee: { property: { name: 'addAnswer' } },
    }

    const node3: INode = {
        type: 'VariableDeclaration',
    }

    assert.equal(isInsideAddActionOrAddAnswer(node1), true)
    assert.equal(isInsideAddActionOrAddAnswer(node2), true)
    assert.equal(isInsideAddActionOrAddAnswer(node3), false)
})

// Crea una nueva suite de pruebas
test('processDynamicFlowAwait should report issue when not inside AwaitExpression', () => {
    const node: INode = {
        type: 'CallExpression',
        callee: { property: { name: 'flowDynamic' } },
        parent: {
            type: 'test',
        },
    }

    const context = {
        report: (options) => {
            assert.equal(options.node, node)
            assert.equal(options.message, 'Please use "await" before "flowDynamic" function')
        },
    }

    const reportSpy = sinon.spy(context, 'report')

    processDynamicFlowAwait(context)['CallExpression[callee.name="flowDynamic"]'](node)
    assert.ok(reportSpy)
})

test.run()
