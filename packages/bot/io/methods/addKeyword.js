const { generateRef } = require('../../utils/hash')
const { addAnswer } = require('./addAnswer')
const { toJson } = require('./toJson')

/**
 *
 * @param {*} message `string | string[]`
 * @param {*} options {sensitive:boolean} default false
 */
const addKeyword = (keyword, options) => {
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

module.exports = { addKeyword }
