/**
 * LAYER: Domain
 * Contains: addChild — serializes a nested flow into context
 * Rules: Pure flow-data construction. No external side effects.
 * BigO: O(1) score:5
 * keywords: [addChild, addAnswer, TFlow]
 * GOAL: Convert a nested flow definition into a flat context list.
 */
import { toSerialize } from './toSerialize'
import type { TContext, TFlow } from '../../types'

/**
 * @private
 * @param answer - This parameter is not used in the function body and can be removed.
 * @param options - This parameter is not used in the function body and can be removed.
 * @returns Serialized flow object
 */
const addChild = <P>(flowIn: TFlow<P> | null = null): TContext[] => {
    if (!flowIn?.toJson) {
        throw new Error('DEBE SER UN FLOW CON toJSON()')
    }
    return toSerialize(flowIn.toJson())
}

export { addChild }
