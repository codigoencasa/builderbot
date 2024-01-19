import { INode, Context } from '../types'

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
        currentNode = currentNode.parent
    }
    return false
}

const processGotoFlowReturn = (context: Context) => {
    return {
        'CallExpression[callee.name="gotoFlow"]'(node: INode) {
            let parentNode = node.parent

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

export { processGotoFlowReturn, isInsideAddActionOrAddAnswer }
