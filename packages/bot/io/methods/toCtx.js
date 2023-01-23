const { generateRef, generateRefSerialize } = require('../../utils/hash')
/**
 * @deprecate
 * @param answer string
 * @param options {media:string, buttons:[], capture:true default false}
 * @returns
 */
const toCtx = ({ body, from, prevRef, options = {}, index }) => {
    return {
        ref: generateRef(),
        keyword: prevRef,
        answer: body,
        options: options ?? {},
        from,
        refSerialize: generateRefSerialize({ index, answer: body }),
    }
}

module.exports = { toCtx }
