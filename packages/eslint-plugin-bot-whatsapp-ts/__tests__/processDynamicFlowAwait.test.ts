import { spy } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { processDynamicFlowAwait } from '../src/rules/processDynamicFlowAwait'
import { INode } from '../src/types'

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

    const reportSpy = spy(context, 'report')

    processDynamicFlowAwait(context)['CallExpression[callee.name="flowDynamic"]'](node)
    assert.ok(reportSpy)
})

test.run()
