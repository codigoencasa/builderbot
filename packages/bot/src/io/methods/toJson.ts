/**
 * LAYER: Domain
 * Contains: toJson — wraps a context as a JSON getter
 * Rules: Pure data shaping. No external side effects.
 * BigO: O(1) score:5
 * keywords: [toJson, TContext, addAnswer]
 * GOAL: Expose a flow context as a lazily serialized JSON function.
 */
import type { TContext } from '../../types'

const toJson = (inCtx: TContext): (() => TContext[]) => {
    const lastCtx = inCtx.hasOwnProperty('ctx') ? inCtx.ctx : inCtx
    return () => lastCtx.json
}

export { toJson }
