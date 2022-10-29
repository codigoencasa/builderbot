/**
 * 
 * @param {*} message `string | string[]`  
 * @param {*} options {sensitivy:boolean} defaulta false
 */
const addKeyword = (message, options) => {
    if (typeof message === 'string') return 1
    return 0
}

module.exports = { addKeyword }
// await inout.addKeyword('hola')
// .addAnswer('Bienvenido a tu tienda 🥲')
// .addAnswer('escribe *catalogo* o *ofertas*')

// await inout.addKeyword(['catalogo','ofertas'])