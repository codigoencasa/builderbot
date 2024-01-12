import { TContext, TFlow } from '../../types'
import { toSerialize } from './toSerialize'

/**
 * @param answer - This parameter is not used in the function body and can be removed.
 * @param options - This parameter is not used in the function body and can be removed.
 * @returns Serialized flow object
 */
const addChild = (flowIn: TFlow | null = null): TContext[] => {
    if (!flowIn?.toJson) {
        throw new Error('DEBE SER UN FLOW CON toJSON()')
    }
    return toSerialize(flowIn.toJson())
}

export { addChild }
