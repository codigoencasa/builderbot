import { INode, Context } from '../types'
import { isInsideAddActionOrAddAnswer } from '../utils'

const processEndFlowWithFlowDynamic = (context: Context) => {
    return {
        'CallExpression[callee.name="endFlow"]'(node: INode) {
            const functionArguments = node.arguments

            // Verificar si estamos dentro de un 'addAction' o 'addAnswer'
            if (!isInsideAddActionOrAddAnswer(node)) {
                return
            }

            // Verificar si los argumentos incluyen tanto flowDynamic como endFlow
            const includesFlowDynamic = functionArguments.some((arg: { name: string }) => arg.name === 'flowDynamic')
            const includesEndFlow = functionArguments.some((arg: { name: string }) => arg.name === 'endFlow')

            if (includesFlowDynamic && includesEndFlow) {
                context.report({
                    node,
                    message:
                        'Please do not use endFlow in the same execution context as flowDynamic. Alternatively add an addAction((_,{endFlow})=> endFlow())',
                })
            }
        },
    }
}

export { processEndFlowWithFlowDynamic }
