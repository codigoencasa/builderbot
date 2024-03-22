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
