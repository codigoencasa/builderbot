const { generateRef, generateRefSerialize } = require('../../utils/hash')
/**
 * @deprecate
 * @param answer string
 * @param options {media:string, buttons:[], capture:true default false}
 * @returns
 */
const toCtx = ({ body, from, prevRef, keyword, options = {}, index }) => {
    return {
        ref: generateRef(),
        keyword: prevRef ?? keyword,
        answer: body,
        options: options ?? {},
        from,
        refSerialize: generateRefSerialize({ index, answer: body }),
    }
}

module.exports = { toCtx }
