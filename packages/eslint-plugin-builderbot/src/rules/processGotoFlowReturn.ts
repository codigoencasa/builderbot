/**
 * LAYER: Interface
 * Contains: INode, Context
 * Rules: Handles HTTP/CLI. Calls use cases only. No direct domain/infrastructure access.
 * BigO: O(1) score:5
 * keywords: [INode, Context]
 * GOAL: Own the "process goto flow return" concern of the eslint-plugin-builderbot package.
 */
import type { INode, Context } from '../types'
import { isInsideAddActionOrAddAnswer } from '../utils'

const processGotoFlowReturn = (context: Context) => {
    return {
        'CallExpression[callee.name="gotoFlow"]'(node: INode) {
            const parentNode = node.parent

            // Verificar si estamos dentro de un 'addAction' o 'addAnswer'
            if (!isInsideAddActionOrAddAnswer(node)) {
                return
            }

            // Verificar si nodo padre es de tipo ReturnStatement, si no lo es, reportar
            if (parentNode.type !== 'ReturnStatement') {
                context.report({
                    node,
                    message: 'Please ensure "gotoFlow" function is returned',
                    fix: function (fixer) {
                        return fixer.insertTextBefore(node, 'return ')
                    },
                })
            }
        },
    }
}

export { processGotoFlowReturn }
