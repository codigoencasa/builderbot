import { test } from 'uvu'
import * as sinon from 'sinon'
import * as assert from 'uvu/assert'
import { isInsideAddActionOrAddAnswer, processStateUpdateAwait } from '../src/rules/processStateUpdateAwait'

const createMockNode = (type: string, calleeName?: string, objectName?: string): any => ({
    type,
    callee: {
        property: {
            name: calleeName,
        },
    },
    object: {
        name: objectName,
    },
    parent: null as any,
    range: [0, 0],
})

test('isInsideAddActionOrAddAnswer debería retornar true si está dentro de addAction o addAnswer', () => {
    const node = createMockNode('CallExpression', 'addAction')
    const result = isInsideAddActionOrAddAnswer(node)
    assert.is(result, true)
})

test('isInsideAddActionOrAddAnswer debería retornar false si no está dentro de addAction o addAnswer', () => {
    const node = createMockNode('CallExpression', 'someOtherFunction')
    const result = isInsideAddActionOrAddAnswer(node)
    assert.is(result, false)
})

test.run()
