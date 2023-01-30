import { generateRef, generateRefSerialize } from '../../utils/hash'
/**
 * @deprecate
 * @param answer string
 * @param options {media:string, buttons:[], capture:true default false}
 * @returns
 */
export const toCtx = ({ body, from, prevRef, options = {}, index }: any) => {
    return {
        ref: generateRef(),
        keyword: prevRef,
        answer: body,
        options: options ?? {},
        from,
        refSerialize: generateRefSerialize({ index, answer: body }),
    }
}
