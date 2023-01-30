import { toSerialize } from './toSerialize'
/**
 * @deprecate
 * @param answer string
 * @param options {media:string, buttons:[], capture:true default false}
 * @returns
 */
export const addChild = (flowIn: any = null) => {
    if (!flowIn?.toJson) {
        throw new Error('DEBE SER UN FLOW CON toJSON()')
    }
    return toSerialize(flowIn.toJson())
}
