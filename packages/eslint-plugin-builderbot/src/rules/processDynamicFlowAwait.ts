/**
 * LAYER: Interface
 * Contains: Context, INode
 * Rules: Handles HTTP/CLI. Calls use cases only. No direct domain/infrastructure access.
 * BigO: O(1) score:5
 * keywords: [Context, INode]
 * GOAL: Own the "process dynamic flow await" concern of the eslint-plugin-builderbot package.
 */
import type { Context, INode } from '../types'
import { isInsideAddActionOrAddAnswer } from '../utils'

const processDynamicFlowAwait = (context: Context) => {
    return {
        'CallExpression[callee.name="flowDynamic"]'(node: INode) {
            const parentNode = node.parent

            // Verificar si estamos dentro de un 'addAction' o 'addAnswer'
            if (!isInsideAddActionOrAddAnswer(node)) {
                return
            }

            // Verificar si el nodo padre es 'AwaitExpression', de lo contrario se reporta
            if (parentNode.type !== 'AwaitExpression') {
                context.report({
                    node,
                    message: 'Please use "await" before "flowDynamic" function',
                    fix: function (fixer) {
                        return fixer.insertTextBefore(node, 'await ')
                    },
                })
            }
        },
    }
}

export { processDynamicFlowAwait }
