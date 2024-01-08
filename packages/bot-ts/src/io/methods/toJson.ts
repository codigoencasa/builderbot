import { TContext, TFlow } from "../types";

const toJson = (inCtx: TFlow): (() => object) => {
    const lastCtx = (inCtx.hasOwnProperty('ctx') ? inCtx.ctx : inCtx) as TContext;
    return () => lastCtx.json;
}

export { toJson };