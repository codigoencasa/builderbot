const toJson = (inCtx) => () => {
    const lastCtx = inCtx.hasOwnProperty('ctx') ? inCtx.ctx : inCtx
    return lastCtx.json
}

module.exports = { toJson }
