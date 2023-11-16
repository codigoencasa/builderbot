const { flatObject } = require('../../utils/flattener')
const { generateRef } = require('../../utils/hash')
const { addChild } = require('./addChild')
const { toJson } = require('./toJson')
/**
 *
 * @param answer string
 * @param options {media:string, buttons:[{"body":"😎 Cursos"}], delay:ms, capture:true default false}
 * @returns
 */
const addAnswer =
    (inCtx) =>
    (answer, options, cb = null, nested = []) => {
        answer = Array.isArray(answer) ? answer.join('\n') : answer
        /**
         * Todas las opciones referentes a el mensaje en concreto options:{}
         * @returns
         */
        const getAnswerOptions = () => ({
            media: typeof options?.media === 'string' ? `${options?.media}` : null,
            buttons: Array.isArray(options?.buttons) ? options.buttons : [],
            capture: typeof options?.capture === 'boolean' ? options?.capture : false,
            child: typeof options?.child === 'string' ? `${options?.child}` : null,
            delay: typeof options?.delay === 'number' ? options?.delay : 0,
            idle: typeof options?.idle === 'number' ? options?.idle : null,
            ref: typeof options?.ref === 'string' ? options?.ref : null,
        })

        const getNested = () => {
            let flatNested = []
            if (Array.isArray(nested)) {
                for (const iterator of nested) {
                    flatNested = [...flatNested, ...addChild(iterator)]
                }

                return {
                    nested: flatNested,
                }
            }
            return {
                nested: addChild(nested),
            }
        }

        /**
         * Esta funcion aplana y busca los callback anidados de los hijos
         * @returns
         */
        const getCbFromNested = () => flatObject(Array.isArray(nested) ? nested : [nested])

        const callback = typeof cb === 'function' ? cb : () => null

        const lastCtx = inCtx.hasOwnProperty('ctx') ? inCtx.ctx : inCtx

        /**
         * Esta funcion se encarga de mapear y transformar todo antes
         * de retornar
         * @returns
         */
        const ctxAnswer = () => {
            const options = {
                ...getAnswerOptions(),
                ...getNested(),
                keyword: {},
                callback: !!cb,
            }
            const ref = options?.ref ?? `ans_${generateRef()}`

            const json = [].concat(inCtx.json).concat([
                {
                    ref,
                    keyword: lastCtx.ref,
                    answer,
                    options,
                },
            ])

            const callbacks = {
                ...inCtx.callbacks,
                ...getCbFromNested(),
                [ref]: callback,
            }

            return {
                ...lastCtx,
                ref,
                answer,
                json,
                options,
                callbacks,
            }
        }

        /// Retornar contexto no colocar nada más abajo de esto
        const ctx = ctxAnswer()

        return {
            ctx,
            ref: ctx.ref,
            addAnswer: addAnswer(ctx),
            addAction: (cb = () => null, flagCb = () => null) => {
                if (typeof cb === 'object') return addAnswer(ctx)('__capture_only_intended__', cb, flagCb)
                return addAnswer(ctx)('__call_action__', null, cb)
            },
            toJson: toJson(ctx),
        }
    }

module.exports = { addAnswer }
