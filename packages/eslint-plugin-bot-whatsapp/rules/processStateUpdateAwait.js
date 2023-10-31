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

const processStateUpdateAwait = (context) => {
    return {
        'MemberExpression[property.name="update"]'(node) {
            // Verificar si el objeto es 'state'
            if (node.object.name !== 'state') {
                return
            }

            if (node.object.name === 'state') {
                const sourceCode = context.getSourceCode()
                const rangeStart = node.range[0] - 6 // Longitud de "await "
                const rangeEnd = node.range[0]
                const parentNodeText = sourceCode.getText().substring(rangeStart, rangeEnd)
                if (parentNodeText.includes('await')) {
                    return
                }
            }

            let parentNode = node.parent
            // Verificar si estamos dentro de un 'addAction' o 'addAnswer'
            if (!isInsideAddActionOrAddAnswer(node)) {
                return
            }

            // Verificar si el nodo padre es 'AwaitExpression', de lo contrario se reporta
            if (parentNode.type !== 'AwaitExpression') {
                context.report({
                    node,
                    message: 'Please use "await" before "state.update"',
                    fix: function (fixer) {
                        // Comprueba si existe un await antes de state.update
                        const sourceCode = context.getSourceCode()
                        const rangeStart = node.range[0] - 7 // Longitud de "await "
                        const rangeEnd = node.range[0]
                        const parentNodeText = sourceCode.getText().substring(rangeStart, rangeEnd)

                        if (parentNodeText.trim() !== 'await') {
                            return fixer.insertTextBefore(node, 'await ')
                        }
                    },
                })
            }
        },
    }
}

module.exports = { processStateUpdateAwait }
