const { generateRef } = require('../utils')
const { addAnswer } = require('./addAnswer')
/**
 * addKeyword:
 * Es necesario que genere id|hash
 */

/**
 *
 * @param {*} message `string | string[]`
 * @param {*} options {sensitivy:boolean} defaulta false
 */
const addKeyword = (message, options) => {
    const ctxAddKeyword = () => {
        const ref = generateRef()
        /**
         * Se guarda en db
         */

        return { ref, keyword: message }
    }

    const ctx = ctxAddKeyword()

    return {
        ctx,
        ref: ctx.ref,
        addAnswer: addAnswer(ctx),
    }
}

module.exports = { addKeyword }
