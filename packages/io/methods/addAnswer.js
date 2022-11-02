const { generateRef } = require('../utils')
const { toJson } = require('./toJson')
/**
 *
 * @param answer string
 * @param options {media:string, buttons:[]}
 * @returns
 */
const addAnswer = (inCtx) => (answer, options) => {
    const getAnswerOptions = () => ({
        media: typeof options?.media === 'string' ? `${options?.media}` : null,
        buttons: Array.isArray(options?.buttons) ? options.buttons : [],
    })

    const lastCtx = inCtx.hasOwnProperty('ctx') ? inCtx.ctx : inCtx
    const ctxAnswer = () => {
        const ref = `ans_${generateRef()}`

        const json = [].concat(inCtx.json).concat([
            {
                ref,
                keyword: lastCtx.ref,
                answer,
            },
        ])
        /**
         * Se guarda en db
         */

        const options = {
            answer: getAnswerOptions(),
            keyword: {},
        }

        return { ...lastCtx, ref, answer, json, options }
    }

    const ctx = ctxAnswer()

    return {
        ctx,
        ref: ctx.ref,
        addAnswer: addAnswer(ctx),
        toJson: toJson(ctx),
    }
}

module.exports = { addAnswer }
