/**
 * LAYER: Domain
 * Contains: toCtx — maps an incoming message to a TContext
 * Rules: Pure mapping. No external side effects.
 * BigO: O(1) score:5
 * keywords: [toCtx, TContext, ActionPropertiesKeyword]
 * GOAL: Build the flow context for a message using its keyword and options.
 */
import type { ActionPropertiesKeyword, TContext } from '../../types'
import { generateRef, generateRefSerialize } from '../../utils/hash'

type Options = Partial<ActionPropertiesKeyword>

interface ToCtxParams {
    body: string
    from: string
    prevRef?: string
    keyword?: string
    options?: Options
    index?: number
}

/**
 * @param params ToCtxParams
 * @returns Context
 */
const toCtx = ({ body, from, prevRef, keyword, options = {}, index }: ToCtxParams): TContext => {
    return {
        ref: generateRef(),
        keyword: prevRef ?? keyword,
        answer: body,
        options: options,
        from,
        refSerialize: generateRefSerialize({ index, answer: body }),
    }
}

export { toCtx }
