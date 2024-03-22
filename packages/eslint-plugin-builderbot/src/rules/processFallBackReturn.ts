import type { INode, Context } from '../types'
import { isInsideAddActionOrAddAnswer } from '../utils'

const processFallBackReturn = (context: Context) => {
    return {
        'CallExpression[callee.name="fallBack"]'(node: INode) {
            const parentNode = node.parent

            // Verificar si estamos dentro de un 'addAction' o 'addAnswer'
            if (!isInsideAddActionOrAddAnswer(node)) {
                return
            }

            // Verificar si nodo padre es de tipo ReturnStatement, si no lo es, reportar
            if (parentNode.type !== 'ReturnStatement') {
                context.report({
                    node,
                    message: 'Please ensure "fallBack" function is returned',
                    fix: function (fixer) {
                        return fixer.insertTextBefore(node, 'return ')
                    },
                })
            }
        },
    }
}

export { processFallBackReturn }
