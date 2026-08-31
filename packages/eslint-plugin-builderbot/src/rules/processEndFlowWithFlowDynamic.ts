import type { INode, SourceCodeContext } from '../types'
import { isInsideAddActionOrAddAnswer } from '../utils'

const processEndFlowWithFlowDynamic = (context: SourceCodeContext) => {
    return {
        'CallExpression[callee.name="endFlow"]'(node: INode) {
            if (!isInsideAddActionOrAddAnswer(node)) {
                return
            }

            const blockStatement = context.sourceCode
                .getAncestors(node)
                .find((ancestor: { type: string }) => ancestor.type === 'BlockStatement')
            if (blockStatement) {
                const calleInsideCtx = blockStatement.body.map(
                    (j: { expression: { argument: { callee: { name: any } } } }) =>
                        j?.expression?.argument?.callee?.name
                )
                if (calleInsideCtx.includes('flowDynamic')) {
                    context.report({
                        node,
                        message: 'Do not use endFlow in the same execution context as flowDynamic.',
                    })
                }
            }
        },
    }
}

export { processEndFlowWithFlowDynamic }
