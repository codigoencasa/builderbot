const { addKeyword, addAnswer } = require('./methods')
module.exports = { addKeyword, addAnswer }
// const test = async () => {
//     const cxtA = addKeyword('hola')
//     console.log({ cxtA: cxtA.ctx.keyword, ref: cxtA.ref })
//     const cxtB = addAnswer(cxtA)('b')
//     console.log({ cxtB: cxtB.ctx.message, ref: cxtB.ref })
//     const cxtC = addAnswer(cxtB)('c')
//     console.log({ cxtC: cxtC.ctx.keyword, ref: cxtC.ref })
// }

// const test1 = async () => {
//     const cxtAB = addKeyword('hola').addAnswer('b').addAnswer('c')

//     console.log({
//         keyword: cxtAB.ctx.keyword,
//         anwser: cxtAB.ctx.message,
//     })
// }

// const test2 = async () => {
//     const cxtABB = addKeyword('hola')
//         .addAnswer('Bienvenido a tu tienda 🥲')
//         .addAnswer('escribe *catalogo* o *ofertas*')

//     console.log({
//         pregunta: cxtABB.ctx.keyword,
//         ultimasrespuesta: cxtABB.ctx.message,
//     })
// }

// test2().then()
