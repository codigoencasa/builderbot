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
    source_id?: string
    source_type?: string
    ctwa_id?: string
}

/**
 * @param params ToCtxParams
 * @returns Context
 */
const toCtx = ({
    body,
    from,
    prevRef,
    keyword,
    options = {},
    index,
    source_id,
    source_type,
    ctwa_id,
}: ToCtxParams): TContext => {
    return {
        ref: generateRef(),
        keyword: prevRef ?? keyword,
        answer: body,
        options: options,
        from,
        refSerialize: generateRefSerialize({ index, answer: body }),
        source_id,
        source_type,
        ctwa_id,
    }
}

export { toCtx }
