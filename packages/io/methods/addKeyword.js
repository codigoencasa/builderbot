const { generateRef } = require('../utils')
const { addAnswer } = require('./addAnswer')
/**
 * addKeyword:
 * Es necesario que genere id|hash
 */

/**
 *
 * @param {*} message `string | string[]`
 * @param {*} options {sensitive:boolean} default
 */
const addKeyword = (keyword, options) => {
    /**
     * Esta funcion deberia parsear y validar las opciones
     * del keyword
     * @returns
     */
    const parseOptions = () => {
        const defaultProperties = {
            sensitive: options?.sensitive ?? true,
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
    }
}

module.exports = { addKeyword }
