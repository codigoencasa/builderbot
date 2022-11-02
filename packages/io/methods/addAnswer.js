const { generateRef } = require('../utils')

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
        const ref = generateRef()
        /**
         * Se guarda en db
         */

        const options = {
            answer: getAnswerOptions(),
            keyword: {},
        }

        return { ...lastCtx, ref, answer, options }
    }

    const ctx = ctxAnswer()

    return {
        ctx,
        ref: ctx.ref,
        addAnswer: addAnswer(ctx),
    }
}

module.exports = { addAnswer }
