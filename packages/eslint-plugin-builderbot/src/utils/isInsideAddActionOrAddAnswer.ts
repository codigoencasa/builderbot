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
