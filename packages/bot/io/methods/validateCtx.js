const { generateRef } = require('../../utils/hash')
/**
 *
 * @param answer string
 * @param options {media:string, buttons:[], capture:true default false}
 * @returns
 */
const validateCtx = ({ body, from }) => {
    return {
        ref: generateRef(),
        keyword: null,
        answer: body,
        options: {},
        from,
    }
}

module.exports = { validateCtx }
