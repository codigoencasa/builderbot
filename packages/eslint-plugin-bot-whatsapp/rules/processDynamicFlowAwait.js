function isInsideAddActionOrAddAnswer(node) {
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

const processDynamicFlowAwait = (context) => {
    return {
        'CallExpression[callee.name="flowDynamic"]'(node) {
            let parentNode = node.parent

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

module.exports = { processDynamicFlowAwait }
