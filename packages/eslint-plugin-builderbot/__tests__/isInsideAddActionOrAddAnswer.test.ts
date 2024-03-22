import { test } from 'uvu'
import * as assert from 'uvu/assert'

import type { INode } from '../src/types'
import { isInsideAddActionOrAddAnswer } from '../src/utils'

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

test.run()
