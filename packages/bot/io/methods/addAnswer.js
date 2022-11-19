const { generateRef } = require('../../utils/hash')
const { toJson } = require('./toJson')
/**
 *
 * @param answer string
 * @param options {media:string, buttons:[], capture:true default false}
 * @returns
 */
const addAnswer =
    (inCtx) =>
    (answer, options, cb = null) => {
        const getAnswerOptions = () => ({
            media:
                typeof options?.media === 'string' ? `${options?.media}` : null,
            buttons: Array.isArray(options?.buttons) ? options.buttons : [],
            capture:
                typeof options?.capture === 'boolean'
                    ? options?.capture
                    : false,
            child:
                typeof options?.child === 'string' ? `${options?.child}` : null,
        })

        const lastCtx = inCtx.hasOwnProperty('ctx') ? inCtx.ctx : inCtx
        const ctxAnswer = () => {
            const ref = `ans_${generateRef()}`

            const callback =
                typeof cb === 'function'
                    ? cb
                    : () => console.log('Callback no definida')

            const options = {
                ...getAnswerOptions(),
                keyword: {},
                callback: !!cb,
            }

            const json = [].concat(inCtx.json).concat([
                {
                    ref,
                    keyword: lastCtx.ref,
                    answer,
                    options,
                },
            ])

            const callbacks = [].concat(inCtx.callbacks).concat([
                {
                    ref: lastCtx.ref,
                    callback,
                },
            ])

            return {
                ...lastCtx,
                ref,
                answer,
                json,
                options,
                callbacks,
            }
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
