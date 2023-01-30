import { Answer } from '../../types/flow.types'

export const toJson = (inCtx: Answer) => () => {
    const lastCtx = inCtx.hasOwnProperty('ctx') ? inCtx.ctx : inCtx
    return lastCtx.json
}
