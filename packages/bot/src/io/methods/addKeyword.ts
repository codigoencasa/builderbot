import { generateRef } from '../../utils/hash'
import { addAnswer } from './addAnswer'
import { toJson } from './toJson'

interface addKeywordOptions {
    sensitive: boolean
}

interface keywordCtx {
    ref: string
    keyword: string | string[]
    options: addKeywordOptions
    json: Array<Omit<keywordCtx, 'json'>>
}

interface flowContext {
    ctx: keywordCtx
    ref: string
    addAnswer: flowContext
    toJson: (ctx: keywordCtx) => Array<Omit<keywordCtx, 'json'>>
}

/**
 *
 * @param {string | string[]} keyword
 * @param {addKeywordOptions} options
 */
export function addKeyword(
    keyword: string | string[],
    options: addKeywordOptions
): flowContext {
    const parseOptions = () => {
        const defaultProperties = {
            sensitive:
                typeof options?.sensitive === 'boolean'
                    ? options?.sensitive
                    : false,
        }

        return defaultProperties
    }

    const ctxAddKeyword = () => {
        const ref = `key_${generateRef()}`
        const options = parseOptions()
        const json = [
            {
                ref,
                keyword,
                options,
            },
        ]
        /**
         * Se guarda en db
         */

        return { ref, keyword, options, json }
    }

    const ctx = ctxAddKeyword()

    return {
        ctx,
        ref: ctx.ref,
        addAnswer: addAnswer(ctx),
        toJson: toJson(ctx),
    }
}
