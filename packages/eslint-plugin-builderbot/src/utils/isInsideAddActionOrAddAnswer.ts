/**
 * LAYER: Infrastructure
 * Contains: IsInsideAddActionOrAddAnswer, INode
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(n) score:3
 * keywords: [IsInsideAddActionOrAddAnswer, INode]
 * GOAL: Own the "is inside add action or add answer" concern of the eslint-plugin-builderbot package.
 */
import type { INode } from '../types'

function isInsideAddActionOrAddAnswer(node: INode) {
    let currentNode = node
    while (currentNode) {
        if (
            currentNode.type === 'CallExpression' &&
            currentNode.callee &&
            currentNode.callee.property &&
            (currentNode.callee.property.name === 'addAnswer' || currentNode.callee.property.name === 'addAction')
        ) {
            return true
        }
        currentNode = currentNode.parent as any
    }
    return false
}

export { isInsideAddActionOrAddAnswer }
