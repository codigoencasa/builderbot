const { generateRef } = require('../utils')

const addAnswer = (inCtx) => (answer, options) => {
    const lastCtx = inCtx.hasOwnProperty('ctx') ? inCtx.ctx : inCtx
    const ctxAnswer = () => {
        const ref = generateRef()
        /**
         * Se guarda en db
         */

        return { ...lastCtx, ref, answer }
    }

    const ctx = ctxAnswer()

    return {
        ctx,
        ref: ctx.ref,
        addAnswer: addAnswer(ctx),
    }
}

module.exports = { addAnswer }

// await inout
//     .addKeyword('hola')
//     .addAnswer('Bienvenido a tu tienda 🥲')
//     .addAnswer('escribe *catalogo* o *ofertas*')
