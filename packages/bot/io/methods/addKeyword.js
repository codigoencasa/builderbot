const { generateRef } = require('../../utils/hash')
const { addAnswer } = require('./addAnswer')
const { toJson } = require('./toJson')

/**
 *
 * @param {*} message `string | string[]`
 * @param {*} options {sensitive:boolean} default false
 */
const addKeyword = (keyword, options) => {
    if (typeof keyword !== 'string' && !Array.isArray(keyword)) {
        throw new Error('DEBE_SER_STRING_ARRAY_REGEX')
    }

    const parseOptions = () => {
        const defaultProperties = {
            sensitive: typeof options?.sensitive === 'boolean' ? options?.sensitive : false,
            regex: typeof options?.regex === 'boolean' ? options?.regex : false,
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
        addAction: (cb = () => null) => addAnswer(ctx)('__call_action__', null, cb),
        toJson: toJson(ctx),
    }
}

module.exports = { addKeyword }
