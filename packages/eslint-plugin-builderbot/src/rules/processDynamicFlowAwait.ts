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
